'use strict';

import Botkit from 'botkit';
import memStorage from './utils/mem-storage';
import { asyncCollect, asyncWaterfall, asyncify } from './utils/async';
import gcConnector from './utils/gc-scheduler';

const GC_CONNECTOR = gcConnector();

const controller = Botkit.slackbot({
  debug: process.env.DEBUG === 'true',
  storage: memStorage
});

const bot = controller.spawn({
  token: process.env.SLACK_TOKEN
});

// SENDS signals to the GC_CONNECTOR
// if the argument is a Promise, waits for the resolution
// or calls the connector right away
function sendToQueue(obj) {
  if (typeof obj.then === 'function') {
    obj.then((res) => {
      if (res) {
        GC_CONNECTOR.addSignals(res);
      }
    });
  }
  else {
    if (obj) {
      GC_CONNECTOR.addSignals(obj);
    }
  }
}

function saveUser (user) {
  return {
    action: 'node_create',
    type: 'User',
    name: user.name,
    properties: {
      user_id: user.id
    }
  };
}

function saveChannel(channel) {
  return {
    action: 'node_create',
    type: 'Channel',
    name: channel.name,
    properties: {
      channel_id: channel.id
    }
  };
}

function asyncSaveChannelMembers(channel) {
  return asyncCollect(channel.members, (member, done) => {
    controller.storage.users.get(member, (err, user_data) => {
      done(createUserMEMBEROFChannel(user_data.name, channel.name));
    });
  });
}

function createUserMEMBEROFChannel(user, channel) {
  return {
    action: 'edge_create',
    name: 'MEMBER OF',
    from_type: 'User',
    from_name: user,
    to_type: 'Channel',
    to_name: channel,
    properties: {
      since: Date.now()
    }
  };
}

function saveMessage(message) {

  let signals = [];
  const channel_data = controller.storage.channels.getSync(message.channel);
  const user_data = controller.storage.users.getSync(message.user);
  if (!channel_data || !user_data) {
    return null;
  }

  const message_name = `${user_data.name} - ${message.ts}`;
  signals.push({
    action: 'node_create',
    type: 'Message',
    name: message_name,
    description: message.text,
    properties: {
      ts: message.ts,
      channel_name: channel_data.name
    }
  });

  signals.push({
    action: 'edge_create',
    name: 'SENT_MESSAGE',
    from_type: 'User',
    from_name: user_data.name,
    to_type: 'Message',
    to_name: message_name
  });

  signals.push({
    action: 'edge_create',
    name: 'MESSAGE_IN',
    from_type: 'Message',
    from_name: message_name,
    to_type: 'Channel',
    to_name: channel_data.name
  });

  let mentionMatches = message.text.match(/<@(U[^\s]+)>/);
  if (mentionMatches.length > 0) {
    mentionMatches.forEach( (match) => {
      let mentioned_user = controller.storage.users.getSync(match);
      if (mentioned_user) {
        signals.push({
          action: 'edge_create',
          name: 'MENTIONS',
          from_type: 'Message',
          from_name: message_name,
          to_type: 'User',
          to_name: mentioned_user.name
        });
      }
    });
  }

  return signals;
}

function updateMessageDeleted(payload) {
  return asyncify((done, fail) => {
    const prev_message = payload.previous_message;
    controller.storage.users.get(prev_message.user, (err, user_data) => {
      if (err) {
        return fail(err);
      }

      const message_name = `${user_data.name} - ${prev_message.ts}`;
      done({
        action: 'node_update',
        type: 'Message',
        name: message_name,
        properties: {
          is_deleted: 1,
          deleted_ts: payload.deleted_ts
        },
        prev: {
          properties: {
            is_deleted: null,
            deleted_ts: null
          }
        }
      });
    });
  });
}

function asyncProcessAllInitialUsersAndChannels(bot, users, channels) {
  return asyncWaterfall([
    {
      items: users,
      fn: (user, done) => {
        controller.storage.users.save(user, () => {
          done(saveUser(user));
        });
      }
    },
    {
      items: channels,
      fn: (channel, done) => {
        controller.storage.channels.save(channel, () => {
          done(saveChannel(channel));
        });
      }
    },
    {
      items: channels,
      fn: (channel, done) => {
        // On startup, only channels the bot is a member of is given
        // so we request channel info for non-member channels to
        // get their members
        if (channel.is_member) {
          asyncSaveChannelMembers(resp.channel).then((res) => {
            done([].concat.apply([], res));
          });
        }
        else {
          bot.api.channels.info({channel: channel.id}, (err, resp) => {
            asyncSaveChannelMembers(resp.channel).then((res) => {
              done([].concat.apply([], res));
            });
          });
        }
      },
      flatten: true
    }
  ]);
}

bot.startRTM((err, bot, payload) => {
  if (err) {
    throw new Error(err);
  }
  asyncProcessAllInitialUsersAndChannels(bot, payload.users, payload.channels).then((res) => {
    sendToQueue([].concat.apply([], res));
  });
});

controller.on('channel_created', (bot, payload) => {
  let channel = payload.channel;
  sendToQueue(saveChannel(channel));
});

controller.on('channel_joined', (bot, payload) => {
  let channel = payload.channel;
  sendToQueue(asyncSaveChannelMembers(channel))
});

// listens to ambient messaging in the channels
controller.on('ambient', (bot, message) => {
  sendToQueue(saveMessage(message));
});

controller.on('message_deleted', (bot, payload) => {
  sendToQueue(updateMessageDeleted(payload));
});

controller.on('channel_deleted', (bot, payload) => {
  // TODO
});

controller.on('user_channel_join', (bot, payload) => {
  // TODO
});

controller.on('user_channel_left', (bot, payload) => {
  // TODO
});

controller.on('message_changed', (bot, payload) => {
  // TODO
});

controller.on('team_join', (bot, payload) => {
  // TODO
});

controller.on('channel_archive', (bot, payload) => {
  // TODO
});

controller.on('channel_unarchive', (bot, payload) => {
  // TODO
});

controller.on('channel_rename', (bot, payload) => {
  // TODO
});
