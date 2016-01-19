# gc-slackbot

Creates a bot to track public activity in Slack channels. Written for NodeJS.

#### Quick Deploy [![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/artsince/gc-slackbot)
This will deploy this app on [Heroku](https://heroku.com) to demo it right away. On the Heroku deployment setup page you will be required to enter authentication tokens for Graph Commons and Slack. See [Requirements](#Requirements) below for details and have the required keys ready before starting the app.

#### Usage
* Add the bot user to a channel to track public activity in a channel.
* Mention graph bots in a message with `graph url` to see the link to the graph on Graph Commons.
* In a direct message to the bot, ask `who mentioned me?` or `who did i mention?` to receive the
list of users you mentioned.

#### Requirements
* Graph Commons API Key: Create a [Graph Commons](https://graphcommons.com) account if you haven't already. Generate an API key on your [profile](https://graphcommons.com/me/edit).
* Slack Bot API Token: Create [a new bot user integration](https://my.slack.com/services/new/bot). You will be given a authentication token for the bot.
* Graph ID: This is optional, though highly recommended. If a graph id is supplied, the bot will work with the existing id, instead of creating a new one. A good practice would be to create an empty graph to be used by the app prior to deployment. Otherwise a new graph will be created every time the app restarts.


### Development
Developed on NodeJS 4.x using ES2015 syntax using babel.

#### Build and Run
```sh
git clone https://gitlab.com/ahmetkizilay/gc-slackbot
cd gc-slackbot
npm install
npm start
```

#### Running tests [ ![Codeship Status for artsince/gc-slackbot](https://codeship.com/projects/b7b5e5f0-a0ed-0133-b6b7-02e3d0645add/status?branch=master)](https://codeship.com/projects/128302)
Tests are implemented with Jasmine. Since the app needs to connect to Graph Commons and Slack at the same
time, there are no integration tests at the moment.

To run tests, call:
```sh
npm test
```

See package.json for other npm scripts, such as linting.

#### Environment Variables
* SLACK_TOKEN=
* GC_TOKEN=
* GRAPH_ID=
* DEBUG=true/false (runs howdy slackbot in debug mode with plenty of logging)

You can use a `.env` file to store environment variables. The app will load them
on startup.

#### Graph Structure
- Node Types
  * User: A member in a team
    - user_id
  * Channel: A channel in Slack team
    - channel_id
    - archived
    - closed
  * Message
    - ts
    - deleted

- Edge Types
  * MEMBER_OF: A user is a member of a channel
  * SENT_MESSAGE: A user sends a message
  * BELONGS_TO: A message belongs to a channel
  * MENTIONS: A message mentions a user

#### License
MIT
