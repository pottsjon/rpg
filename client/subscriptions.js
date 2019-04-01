// client-side collections
Leaders = new Meteor.Collection("leaders");
Prospects = new Meteor.Collection("prospects");

// client-side only collections
sysMsgs = new Meteor.Collection(null);
hitCities = new Meteor.Collection(null);

Meteor.subscribe('tasks');
Meteor.subscribe('items');
Meteor.subscribe('workers');
Meteor.subscribe('skills');
Meteor.subscribe('inventory');
Meteor.subscribe('queues');
Meteor.subscribe('sysmsgs');
Meteor.subscribe('hitcities');
Meteor.subscribe('cities');
Meteor.subscribe('positions');
Meteor.subscribe('stalls');