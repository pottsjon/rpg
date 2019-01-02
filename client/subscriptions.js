// client-side collections
Employees = new Meteor.Collection("employees");
Leaders = new Meteor.Collection("leaders");
sysMsgs = new Meteor.Collection(null);

Meteor.subscribe('tasks');
Meteor.subscribe('items');
Meteor.subscribe('workers');
Meteor.subscribe('employees');
Meteor.subscribe('skills');
Meteor.subscribe('queues');
Meteor.subscribe('inventory');
Meteor.subscribe('sysmsgs');