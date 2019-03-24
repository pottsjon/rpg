SyncedCron.config({
    log: false
});

SyncedCron.start();

SyncedCron.add({
  name: 'Evaluate/Replenish Workforce',
  schedule: function(parser) {
    return parser.text('every 5 minutes');
  },
  job: function() {
    workforceEvaluate();
  }
});