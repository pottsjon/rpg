Template.login.onCreated(function() {
	this.returnLogin = new ReactiveVar( false );
	try { runningInventory.stop() } catch (e) { };
});

Template.login.helpers({
	showReturning() {
		return Template.instance().returnLogin.get();
	}
});

Template.login.events({
	'click .notReturning'(e,t) {
		t.returnLogin.set(false);
	},
	'keyup .loginPass, keyup .loginEmail'(e) {
		if ( e.type == "keyup" && e.which == 13 ) {
			const user = {
				email: $( '[name="email"]' ).val(),
				password: $( '[name="password"]' ).val()
			};
			if(user.email && user.password){
				Meteor.loginWithPassword(user.email, user.password, function( error ) {
				sAlert.error(error);	  
				});
			};
		};
	},
	'click .createAccount'(e) {
		e.preventDefault();	
		tryCreatingUser = function (selectedUsername) {
			let user = {
				username: selectedUsername,
				password: Random.id(8)
			};
			Accounts.createUser(user, function( error ) {
				if ( error )
				randomUsername();
			});
		}
		randomUsername = function () {
			let usernameNominee = Fake.word();
			if ( usernameNominee.length >= 3 && usernameNominee.length <= 10 ) {
				const selectedUsername = usernameNominee;
				tryCreatingUser(selectedUsername);
			} else {
        		randomUsername();			
			};
		}
		randomUsername();
		user = null;
		usernameNominee = null;
	},
	'click .forgotPassword'() {
		const email = $( '[name="email"]' ).val();
		if ( !email ) {
			sAlert.error('Must enter an email address.');
		} else {
			Accounts.forgotPassword({ email: $( '[name="email"]' ).val() }, function (e, r) {
			}); 
		};
	},
	'click .signIn'(e,t) {
		e.preventDefault();
		if ( t.returnLogin.get() ) {
			const user = {
				username: $('[name="username"]').val(),
				email: $('[name="email"]').val(),
				password: $('[name="password"]').val()
			};
			if(user.email && user.password){
				Meteor.loginWithPassword(user.email, user.password, function( error ) {
					sAlert.error(error);
				});
			} else if (user.username && user.password){
				Meteor.loginWithPassword(user.username, user.password, function( error ) {
					sAlert.error(error);
				});
			};
		} else {
			t.returnLogin.set(true);
		};
	}
});