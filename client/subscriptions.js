// client-side collections
Prospects = new Meteor.Collection("prospects");
Employees = new Meteor.Collection("employees");

Meteor.subscribe('prospects');
Meteor.subscribe('employees');
Meteor.subscribe('queues');
Meteor.subscribe('inventory');