'use strict';

import request from 'request';
import { asyncCollect, asyncWaterfall, asyncify } from './async';
import jobQueue from './job-queue';

const USER = 'User';
const CHANNEL = 'Channel';
const MESSAGE = 'Message';
const MEMBER_OF = 'MEMBER_OF';
const SENT_MESSAGE = 'SENT_MESSAGE';
const MENTIONS = 'MENTIONS';
const MESSAGE_IN = 'MESSAGE_IN';

let GraphCommonsConnector = (opts) => {

  const GC_ROOT = process.env.GC_ROOT || 'https://graphcommons.com';
  let storage = opts.storage;
  let bot = opts.bot;
  let graphId = opts.graphId;
  let graphData = {
    edges: {
      [MEMBER_OF]: {}
    }
  };

  let sendToScheduler = function (job) {

    if (typeof job.then === 'function') {
      job.then((res) => {
        if (res) {
          scheduler.addJob(res);
        }
      });
    }
    else {
      scheduler.addJob(job);
    }
  };

  let buildNewUserSignal = function (user) {
    return {
      action: 'node_create',
      type: USER,
      name: user.name,
      image: user.profile.image_192,
      properties: {
        user_id: user.id
      }
    };
  };

  let buildNewChannelSignal = function (channel) {

    return {
      action: 'node_create',
      type: CHANNEL,
      name: channel.name,
      properties: {
        channel_id: channel.id
      }
    };
  };

  let buildUserChannelSignals = function (channel) {

    let signals = [];
    channel.members.forEach((member) => {
      const member_data = storage.users.getSync(member);
      if (member_data) {
        signals.push({
          action: 'edge_create',
          name: MEMBER_OF,
          from_type: USER,
          from_name: member_data.name,
          to_type: CHANNEL,
          to_name: channel.name,
          properties: {
          }
        })
      }
    });

    return signals;
  };

  let initialize = function (users, channels) {

    const job = asyncWaterfall([
      {
        items: users,
        fn: (user, done) => {
          storage.users.save(user, () => {
            done(buildNewUserSignal(user));
          });
        }
      },
      {
        items: channels,
        fn: (channel, done) => {
          storage.channels.save(channel, () => {
            done(buildNewChannelSignal(channel));
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
            done(buildUserChannelSignals(channel));
          }
          else {
            bot.api.channels.info({channel: channel.id}, (err, resp) => {
              done(buildUserChannelSignals(resp.channel));
            });
          }
        },
        flatten: true
      }
    ]);

    sendToScheduler(job);

  };

  let onMessageReceived = function (message) {

    let signals = [];
    const channel_data = storage.channels.getSync(message.channel);
    const user_data = storage.users.getSync(message.user);
    if (!channel_data || !user_data) {
      return null;
    }

    const message_name = `${user_data.name} - ${message.ts}`;
    signals.push({
      action: 'node_create',
      type: MESSAGE,
      name: message_name,
      description: message.text,
      properties: {
        ts: message.ts,
        channel_name: channel_data.name
      }
    });

    signals.push({
      action: 'edge_create',
      name: SENT_MESSAGE,
      from_type: 'User',
      from_name: user_data.name,
      to_type: 'Message',
      to_name: message_name
    });

    signals.push({
      action: 'edge_create',
      name: MESSAGE_IN,
      from_type: 'Message',
      from_name: message_name,
      to_type: 'Channel',
      to_name: channel_data.name
    });

    let mentionMatches = message.text.match(/<@(U[^\s]+)>/);
    if (mentionMatches && mentionMatches.length > 0) {
      mentionMatches.forEach( (match) => {
        let mentioned_user = storage.users.getSync(match);
        if (mentioned_user) {
          signals.push({
            action: 'edge_create',
            name: MENTIONS,
            from_type: 'Message',
            from_name: message_name,
            to_type: 'User',
            to_name: mentioned_user.name
          });
        }
      });
    }

    sendToScheduler(signals);
  };

  let onUserJoinedChannel = function (message) {

    var user_data = storage.users.getSync(message.user);
    var channel_data = storage.channels.getSync(message.channel);
    if (user_data && channel_data) {
      sendToScheduler({
        action: 'edge_create',
        name: MEMBER_OF,
        from_type: USER,
        from_name: user_data.name,
        to_type: CHANNEL,
        to_name: channel_data.name,
        properties: {
          ts: message.ts
        }
      });
    }
  };

  let onUserLeftChannel = function (message) {

    var user_data = storage.users.getSync(message.user);
    var channel_data = storage.channels.getSync(message.channel);
    if (user_data && channel_data) {
      const edge_id = graphData.edges[MEMBER_OF][`${user_data.gc_id}-${channel_data.gc_id}`];

      if (edge_id) {
        sendToScheduler({
          action: 'edge_update',
          name: MEMBER_OF,
          id: edge_id,
          from: user_data.gc_id,
          to: channel_data.gc_id,
          properties: {
            left_at: message.ts
          },
          prev: {
            left_at: null
          }
        });
      }
    }
  };

  let remoteCreateGraph = function() {

    const body = JSON.stringify({
      name: 'My Slack graph',
      description: 'This is a generated graph',
      status: 0,
      signals: [
        {
          action: 'nodetype_create',
          name: USER,
          properties: [{
            name: 'user_id',
            name_alias: 'user_id'
          }]
        },
        {
          action: 'nodetype_create',
          name: CHANNEL,
          properties: [
            {
              name: 'channel_id',
              name_alias: 'channel_id'
            }
          ]
        },
        {
          action: 'nodetype_create',
          name: MESSAGE,
          properties: [
            {
              name: 'ts',
              name_alias: 'ts'
            },
            {
              name: 'deleted',
              name_alias: 'deleted'
            }
          ]
        },
        {
          action: 'edgetype_create',
          name: MEMBER_OF,
          directed: 1,
          properties: [
            {
              name: 'joined_at',
              name_alias: 'joined_at'
            },
            {
              name: 'left_at',
              name_alias: 'left_at'
            }
          ]
        }
      ]
    });

    const options = {
      url: `${GC_ROOT}/api/v1/graphs`,
      method: 'POST',
      headers: {
        'Authentication': process.env.GC_TOKEN,
        'Content-Type': 'application/json'
      },
      body: body
    };

    return asyncify((done, fail) => {
      request(options, (err, response, body) => {
        if (err) {
          return fail(err);
        }

        const respJSON = JSON.parse(body);
        done(respJSON.graph.id);
      });
    });
  };

  let remoteSendSignals = function (signals) {

    let body = JSON.stringify({
      signals: Array.isArray(signals) ? signals : [signals]
    });

    const options = {
      url: `${GC_ROOT}/api/v1/graphs/${graphId}/add`,
      method: 'PUT',
      headers: {
        'Authentication': process.env.GC_TOKEN,
        'Content-Type': 'application/json'
      },
      body: body
    };

    return asyncify((done, fail) => {
      request(options, (err, response, body) => {
        if (err) {
          return fail(err);
        }

        try {
          const responseJSON = JSON.parse(body);
          done(responseJSON);
        }
        catch(e) {
          done();
        }

      });
    });
  };

  let onSignalsSaved = function (resp) {

    const signals = resp.graph.signals;
    if (!signals) {
      return;
    }

    signals.forEach((signal) => {
      switch(signal.action) {
        case 'nodetype_create':
          break;
        case 'edgetype_create':
          break;
        case 'node_create':
          switch (signal.type) {
            case USER:
              storage.users.save({
                id: signal.properties.user_id,
                gc_id: signal.id
              });
              break;
            case CHANNEL:
              storage.channels.save({
                id: signal.properties.channel_id,
                gc_id: signal.id
              });
              break;
          }
          break;
        case 'edge_create':
          if (signal.name === MEMBER_OF) {
            graphData.edges[MEMBER_OF][`${signal.from}-${signal.to}`] = signal.id;
          }
          break;
      }

    });
  };

  let getGraphUrl = function() {
    return `${GC_ROOT}/graphs/${graphId}`;
  };

  let scheduler = jobQueue({
    jobFn: remoteSendSignals,
    jobDone: onSignalsSaved
  });

  if (!graphId) {
    remoteCreateGraph().then((id) => {
      graphId = id;
      scheduler.start();
    });
  }

  return {
    getGraphUrl,
    initialize,
    onMessageReceived,
    onUserJoinedChannel,
    onUserLeftChannel
  };
}

export default GraphCommonsConnector;
