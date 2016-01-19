'use strict';
require('dotenv').load({silent: true});

let gulp = require('gulp');
let eslint = require('gulp-eslint');

gulp.task('lint-src', function () {
    return gulp.src([
      '*.js',
      'utils/*.js'
    ])
    .pipe(eslint({
      envs: ['node']
    }))
    .pipe(eslint.format('tap'))
    .pipe(eslint.failOnError());
});

gulp.task('lint-test', function() {
  return gulp.src([
    'spec/*.js',
    'spec/utils/*.js'
  ])
  .pipe(eslint({
    envs: ['node', 'jasmine']
  }))
  .pipe(eslint.format('tap'))
  .pipe(eslint.failOnError());
});

gulp.task('lint', ['lint-src', 'lint-test']);
