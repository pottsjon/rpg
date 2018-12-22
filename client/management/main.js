Template.management.events({
	'click .userLogout': function() {
		Meteor.logout();
	}
});