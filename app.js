'use strict';

import Botkit from 'botkit';
import { createLogger } from './utils/logger';
import memStorage from './utils/mem-storage';
import { asyncCollect, asyncWaterfall, asyncify } from './utils/async';
import graphCommonsConnector from './utils/gc-connector';

var logger = createLogger();

/*
  We have a controller and a bot.
  Controller manages the environment, acts as a bridge to Slack and creates bots.
  We only need one bot in this app and it is created below.
*/
const controller = Botkit.slackbot({
  debug: process.env.DEBUG === 'true',
  storage: memStorage()
});

const bot = controller.spawn({
  token: process.env.SLACK_TOKEN
});

const GC_CONNECTOR = graphCommonsConnector({
  storage: controller.storage,
  bot: bot,
  graphId: process.env.GRAPH_ID
});

/*
  Establish connection to Slack.
  Upon connection a big chunk of data containing user and channel
  information is received. We pass the data to the GC_CONNECTOR
  to save the initial data in the storage.
*/
const connectToRTM = function() {
  bot.startRTM((err, bot, payload) => {
    if (err) {
      logger.error('Unable to start RTM');
      throw new Error(err);
    }

    logger.info('RTM Started');
    GC_CONNECTOR.synchronizeTeamData(payload.users, payload.channels);
  });
};

GC_CONNECTOR.initialize().then(connectToRTM);

controller.on('rtm_close', (bot, message) => {
  logger.info('RTM Closed');
  logger.info('Will try to reconnect');
  connectToRTM();
});
/*
  listens to ambient messaging in the channels
  ambient messages are messages that do not mention the bot
*/
controller.on('ambient', (bot, message) => {
  GC_CONNECTOR.onMessageReceived(message);
});

controller.on('user_channel_join', (bot, payload) => {
  GC_CONNECTOR.onUserJoinedChannel(payload);
});

controller.on('channel_leave', (bot, payload) => {
  GC_CONNECTOR.onUserLeftChannel(payload);
});

controller.on('channel_created', (bot, payload) => {
  let channel = payload.channel;
  GC_CONNECTOR.onChannelCreated(channel);
});

controller.on('team_join', (bot, payload) => {
  let user = payload.user;
  GC_CONNECTOR.onTeamJoined(user);
});

/*
  Return graph url in response to users mentioning the graph bot with the
  graph url phrase.
*/
controller.hears(['graphurl', 'graph url'],'direct_message,direct_mention,mention', function(bot, payload) {
  const graphUrl = GC_CONNECTOR.getGraphUrl();
  if (graphUrl) {
    bot.reply(payload, 'Here is your team graph on Graph Commons ' + graphUrl);
  }
  else {
    bot.reply(payload, 'Be patient, your team graph is not creaated yet');
  }
});

controller.hears(['mention(ing|s|ed)? me[?]?'], 'direct_message', (bot, payload) => {
  bot.reply(payload, 'Sure, let me check...');

  GC_CONNECTOR.requestMentionsFor(payload.user).then((res) => {

    if (res.length == 0) {
      bot.reply(payload, 'Nobody mentioned you yet :(');
    }
    else {
      bot.reply(payload, 'some of the people who mentioned you are ' + res.map(v => `<@${v}>`).join(', '));
    }
  },
  function() {
    bot.reply(payload, 'Sorry, I can\'t get that information right now');
  });

});

controller.hears(['who (did|am)? i mention(ing|ed)?[?]?', '(users|members) i mention(ing|ed)?'], 'direct_message', (bot, payload) => {
  bot.reply(payload, 'Sure, let me check...');

  GC_CONNECTOR.requestMentionsBy(payload.user).then((res) => {

    if (res.length === 0) {
      bot.reply(payload, 'You haven\'t mentioned anyone yet :(');
    }
    else {
      bot.reply(payload, 'some of the people you mentioned are ' + res.map(v => `<@${v}>`).join(', '));
    }
  },
  function() {
    bot.reply(payload, 'Sorry, I can\'t get that information right now');
  });

});

controller.hears(['suggest (a channel|channels) for me'], 'direct_message,direct_mention,mention', (bot, payload) => {
  bot.reply(payload, 'Sure, give me a sec...');

  GC_CONNECTOR.requestChannelSuggestionsFor(payload.user).then((res) => {

    if (res.length === 0) {
      bot.reply(payload, 'I can\'t find a channel to suggest for you');
      bot.reply(payload, 'Are you in all of them?');
    }
    else {
      bot.reply(payload, 'Here are some channels you can check out: ' + res.map(v => `<#${v}>`).join(', '));
    }
  },
  () => {
    bot.reply(payload, 'Sorry, I can\'t get that information right now...');
  });
})

controller.hears(['hang up'], 'direct_message', (bot, payload) => {
  bot.reply(payload, 'no, you hang up first!');
});
/*
  This part is only added for easier deployment to Heroku.
  Sets up the default webserver to listen on the PORT
*/
controller.setupWebserver(process.env.PORT || 5000, (err, webserver) => {
  controller
    .createHomepageEndpoint(controller.webserver);
});

/*
  Nice to have listeners to be implemented
*/

controller.on('channel_joined', (bot, payload) => {
  let channel = payload.channel;
  // TODO
});

controller.on('message_deleted', (bot, payload) => {
  // TODO
});

controller.on('channel_deleted', (bot, payload) => {
  // TODO
});

controller.on('message_changed', (bot, payload) => {
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
