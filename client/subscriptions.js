// client-side collections
Leaders = new Meteor.Collection("leaders");
Employees = new Meteor.Collection("employees");

// client-side only collections
sysMsgs = new Meteor.Collection(null);
hitCities = new Meteor.Collection(null);

Meteor.subscribe('tasks');
Meteor.subscribe('items');
Meteor.subscribe('workers');
Meteor.subscribe('employees');
Meteor.subscribe('skills');
Meteor.subscribe('inventory');
Meteor.subscribe('queues');
Meteor.subscribe('sysmsgs');
Meteor.subscribe('hitcities');
Meteor.subscribe('cities');
Meteor.subscribe('positions');