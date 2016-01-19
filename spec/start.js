'use strict';

require('babel-core/register');
var path = require('path');
var Jasmine = require('jasmine');
var SpecReporter = require('jasmine-spec-reporter');
var argv = require('minimist')(process.argv.slice(2));

var jasmine = new Jasmine();
jasmine.configureDefaultReporter({print: function(){}});
jasmine.addReporter(new SpecReporter({
  displayStacktrace: 'all',
  displaySpecDuration: true,
  displayPendingSpec: true
}));
jasmine.loadConfigFile(path.join(__dirname, 'support/jasmine.json'));

jasmine.onComplete(function (passed) {
  if (passed) {
    process.exit(0)
  }
  else {
    process.exit(1);
  }
});

var filesToRun = argv ? argv._ : undefined;
jasmine.execute(filesToRun);
