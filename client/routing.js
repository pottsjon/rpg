Router.configure({
	loadingTemplate: 'loading'
});

Router.onBeforeAction(function() {
	if ( !Meteor.userId() ) {
		this.render('login');
	} else {
		this.next();
	};
});  

Router.route('/', {
	waitOn: function() {
        return []
	},
	action: function(){
		this.render('management');
	}
});

Router.route('/gathering', {
	waitOn: function() {
        return [];
	},
	action: function(){
		this.render('gathering');
	}
});

Router.route('/production', {
	waitOn: function() {
        return [];
	},
	action: function(){
		this.render('production');
	}
});

Router.route('/hiring', {
	waitOn: function() {
        return [];
	},
	action: function(){
		this.render('hiring');
	}
});

Router.route('/land', {
	waitOn: function() {
        return [];
	},
	action: function(){
		this.render('land');
	}
});

Router.route('/leaderboard', {
	waitOn: function() {
        return [];
	},
	action: function(){
		this.render('leaderboard');
	}
});