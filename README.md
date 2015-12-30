# gc-slackbot

Creates a bot to track public activity in Slack channels. Written for NodeJS.

#### Quick Deploy [![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/artsince/gc-slackbot)
This will deploy this app on Heroku to demo it right away. On heroku set up page you will be required to enter authentication tokens for Graph Commons and Slack. See [Requirements](#Requirements) below for details and have the keys ready before running the app.

### Usage
Add the bot user to a channel to track public activity in a channel.
mention graph bots in a message with `graph url` to see the link to the graph on Graph Commons.

#### Requirements
* Graph Commons API Key: Create a [Graph Commons](https://graphcommons.com) account if you haven't already. Generate an API key on your [profile](https://graphcommons.com/me/edit).
* Slack Bot API Token: Create [a new bot user integration](https://my.slack.com/services/new/bot). You will be given a authentication token for the bot.

### Development
Developed on NodeJS 4.x using ES2015 syntax using babel.

#### Build and Run
```sh
git clone https://gitlab.com/ahmetkizilay/gc-slackbot
cd gc-slackbot
npm install
npm start
```
See package.json scripts for other options.

#### Environment Variables
* SLACK_TOKEN=
* GC_TOKEN=
* DEBUG=true/false
You can use `.env` file to load the environment variables.

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
    - joined_at
    - left_at
  * SENT_MESSAGE: A user sends a message
  * BELONGS_TO: A message belongs to a channel
  * MENTIONS: A message mentions a user

#### License
MIT
