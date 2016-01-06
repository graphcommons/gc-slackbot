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
  let existingGraph = false;
  let graphData = {
    edges: {
      [MEMBER_OF]: {}
    }
  };

  let loadInitialData = function (graphData) {
    return asyncify((done) => {

      if (graphData.nodes) {
        graphData.nodes.filter(n => n.type === USER).forEach((n) => {
          storage.users.save({
            id: n.properties.user_id,
            gc_id: n.id
          });
        });

        graphData.nodes.filter(n => n.type === CHANNEL).forEach((n) => {
          storage.channels.save({
            id: n.properties.channel_id,
            gc_id: n.id
          });
        });
      }

      if (graphData.edges) {
        let deleteSignals = [];

        graphData.edges.filter(e => e.name === MEMBER_OF).forEach((e) => {
          deleteSignals.push({
            action: 'edge_delete',
            name: MEMBER_OF,
            id: e.id,
            from: e.from,
            to: e.to
          });
        });

        if (deleteSignals.length > 0) {
          sendToScheduler(deleteSignals);
        }
      }

      existingGraph = true;
      scheduler.start();

      done();
    });
  };

  let initialize = function() {

    if (!graphId) {
      existingGraph = false;
      return remoteCreateGraph().then((id) => {
        return asyncify((done) => {
          graphId = id;
          scheduler.start();
          done();
        });
      });
    }
    else {
      // download the graph data
      // delete member channel relations.
      return remoteDownloadGraph(graphId).then(loadInitialData);
    }
  }
  /*
    Initial dump of all users and channels from the team.
    This is the first method to be called after creating the graph on Graph
    Commons. Builds all the nodes and edges for users and channels and
    sends to the scheduler.
  */
  let synchronizeTeamData = function (users, channels) {

    const job = asyncWaterfall([
      {
        items: users,
        fn: (user, done) => {
          let userExists = existingGraph && !!storage.users.getSync(user.id);
          storage.users.save(user, () => {
            done(!userExists ? buildNewUserSignal(user) : undefined);
          });
        }
      },
      {
        items: channels,
        fn: (channel, done) => {
          let channelExists = existingGraph && !!storage.channels.getSync(channel.id);
          storage.channels.save(channel, () => {
            done(!channelExists ? buildNewChannelSignal(channel) : undefined);
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

  /*
    if argument is a promise, wait for the resolution, then send to scheduler,
    else send it right away.
  */
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
        to_name: channel_data.name
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
          action: 'edge_delete',
          name: MEMBER_OF,
          id: edge_id,
          from: user_data.gc_id,
          to: channel_data.gc_id
        });
      }
    }
  };

  let onChannelCreated = function (channel) {
    const channels = storage.channels.allSync();
    var existingChannel, p;
    for (p in channels) {
      if (channels.hasOwnProperty(p)) {
        if (channels[p].name === channel.name) {
          existingChannel = channels[p];
          break;
        }
      }
    }

    if (existingChannel) {
      sendToScheduler({
        action: 'node_update',
        id: existingChannel.gc_id,
        properties: {
          channel_id: channel.id
        },
        prev: {
          properties: {
            channel_id: existingChannel.properties.channel_id
          }
        }
      });
    }
    else {
      storage.channels.save(channel, () => {
        sendToScheduler(buildNewChannelSignal(channel));
      });
    }

  };

  let onTeamJoined = function (user) {
    storage.users.save(user, () => {
      sendToScheduler(buildNewUserSignal(user));
    });
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
          properties: []
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

  let remoteDownloadGraph = function (id) {
    const options = {
      url: `${GC_ROOT}/api/v1/graphs/${id}`,
      method: 'GET',
      headers: {
        'Authentication': process.env.GC_TOKEN,
        'Content-Type': 'application/json'
      }
    };

    return asyncify((done, fail) => {
      request(options, (err, response, body) => {
        if (err) {
          return fail(err);
        }

        const respJSON = JSON.parse(body);
        done(respJSON.graph);
      });
    });
  };

  let remoteSendSignals = function (signals) {
    debugger;
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

  /*
    URL for the Graph Commons graph. graphId would be null until graph is
    created.
  */
  let getGraphUrl = function() {
    if (graphId) {
      return `${GC_ROOT}/graphs/${graphId}`;
    }
  };

  let scheduler = jobQueue({
    jobFn: remoteSendSignals,
    jobDone: onSignalsSaved
  });


  return {
    getGraphUrl,
    initialize,
    synchronizeTeamData,
    onMessageReceived,
    onUserJoinedChannel,
    onUserLeftChannel,
    onChannelCreated,
    onTeamJoined
  };
}

export default GraphCommonsConnector;
