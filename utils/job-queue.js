'use strict';

export default function jobQueue(opts) {
  let started = false;
  let jobs = [];
  let jobFn = opts.jobFn;
  let onJobDone = opts.jobDone

  let run = () => {
    if (jobs.length > 0) {
      jobFn(jobs[0]).then((res) => {
        if (onJobDone) {
          onJobDone.call(null, res);
        }
        jobs.shift();
        run();
      })
    }
    else {
    }
  };

  return {
    addJob: (job) => {
      jobs.push(job);
      if (started) {
        run();
      }
    },
    start: () => {
      started = true;
      run();
    }
  }
}
