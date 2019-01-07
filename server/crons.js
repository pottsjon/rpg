SyncedCron.config({
    log: true
});

SyncedCron.start();

SyncedCron.add({
  name: 'Evaluate/Replenish Workforce',
  schedule: function(parser) {
    return parser.text('every 1 minutes');
  },
  job: function() {
    workforceEvaluate();
  }
});