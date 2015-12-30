'use strict';

import Botkit from 'botkit';
import memStorage from './utils/mem-storage';
import { asyncCollect, asyncWaterfall, asyncify } from './utils/async';
import graphCommonsConnector from './utils/gc-connector';

const controller = Botkit.slackbot({
  debug: process.env.DEBUG === 'true',
  storage: memStorage
});

const bot = controller.spawn({
  token: process.env.SLACK_TOKEN
});

const GC_CONNECTOR = graphCommonsConnector({
  storage: controller.storage,
  bot: bot
});

bot.startRTM((err, bot, payload) => {
  if (err) {
    throw new Error(err);
  }

  GC_CONNECTOR.initialize(payload.users, payload.channels);
});

// listens to ambient messaging in the channels
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
  //TODO:
});

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

controller.hears(['graphurl', 'graph url'],'direct_message,direct_mention,mention', function(bot, payload) {
  const graphUrl = GC_CONNECTOR.getGraphUrl();
  bot.reply(payload, 'Here is your team graph on Graph Commons ' + graphUrl);
});



// This part is not necessary for us at the moment.
// Setting up a webserver lets us seamlessly deploy to heroku with one click

controller.setupWebserver(process.env.PORT || 5000,function(err,webserver) {
  controller
    .createHomepageEndpoint(controller.webserver);
});
