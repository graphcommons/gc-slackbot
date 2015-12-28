'use strict';

import Botkit from 'botkit';
import { asyncCollect, asyncWaterfall, asyncify } from './utils/async';

// WE MAY NOT NEED THIS
// const SLACK_INCOMING_WEBHOOK_URL = `https://hooks.slack.com/services/${process.env.SLACK_WEBHOOK}`;

const controller = Botkit.slackbot({
  debug: process.env.DEBUG === 'true',
  json_file_store: 'team-storage'
});

const bot = controller.spawn({
  token: process.env.SLACK_TOKEN
});

function sendToQueue(obj) {
  if (typeof obj.then === 'function') {
    obj.then(_ => console.dir(_));
  }
  else {
    console.dir(obj);
  }
}

function asyncSaveChannelMembers(channel) {
  return asyncCollect(channel.members, (member, done) => {
    controller.storage.users.get(member, (err, user_data) => {
      done(createUserMEMBEROFChannel(user_data.name, channel.name));
    });
  });
}

function saveChannel(channel) {
  let signals = [];
  signals.push({
    action: 'node_create',
    type: 'Channel',
    name: channel.name,
    properties: {
      channel_id: channel.id
    }
  });

  return signals;
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

function saveMessageEvent(message) {
  return asyncify((done, fail) => {
    controller.storage.channels.get(message.channel, (err, channel_data) => {
      if (err) {
        return fail(err);
      }

      controller.storage.users.get(message.user, (err, user_data) => {
        if (err) {
          return fail(err);
        }

        const messageSignal = {
          action: 'node_create',
          type: 'Message',
          name: `${user_data.name} - ${message.ts}`,
          description: message.text,
          properties: {
            ts: message.ts,
            channel_name: channel_data.name
          }
        };

        const userMessageSignal = {
          action: 'edge_create',
          name: 'SENT_MESSAGE',
          from_type: 'User',
          from_name: user_data.name,
          to_type: 'Message',
          to_name: messageSignal.name
        };

        const messageChannelSignal = {
          action: 'edge_create',
          name: 'MESSAGE_IN',
          from_type: 'Message',
          from_name: messageSignal.name,
          to_type: 'Channel',
          to_name: channel_data.name
        };

        done([messageSignal, userMessageSignal, messageChannelSignal]);
      });
    });
  });
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

function asyncProcessAllInitialUsersAndChannels(users, channels) {
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
      items: channels.filter(_ => _.is_member),
      fn: (channel, done) => {
        asyncSaveChannelMembers(channel).then(done);
      }
    }
  ])
}

bot.startRTM((err, bot, payload) => {
  if (err) {
    throw new Error(err);
  }
  sendToQueue(asyncProcessAllInitialUsersAndChannels(payload.users, payload.channels));
});

controller.on('rtm_open', (bot) => {
  console.log('rtm opened');
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
  sendToQueue(saveMessageEvent(message));
});

controller.on('message_deleted', (bot, payload) => {
  sendToQueue(updateMessageDeleted(payload));
});

controller.on('message_changed', (bot, payload) => {
  // TODO
});
