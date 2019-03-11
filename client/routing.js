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
	onBeforeAction: function() {
		animStart = true;
		animStartDep.changed();
		this.next();
	},
	action: function(){
		this.render();
	}
});

Router.route('/management', {
	waitOn: function() {
        return []
	},
	onBeforeAction: function() {
		animStart = true;
		animStartDep.changed();
		this.next();
	},
	action: function(){
		this.render('management');
	}
});

Router.route('/gathering', {
	waitOn: function() {
        return [];
	},
	onBeforeAction: function() {
		animStart = false;
		animStartDep.changed();
		this.next();
	},
	action: function(){
		this.render('gathering');
	}
});

Router.route('/production', {
	waitOn: function() {
        return [];
	},
	onBeforeAction: function() {
		animStart = false;
		animStartDep.changed();
		this.next();
	},
	action: function(){
		this.render('production');
	}
});

Router.route('/hiring', {
	waitOn: function() {
        return [];
	},
	onBeforeAction: function() {
		animStart = false;
		animStartDep.changed();
		this.next();
	},
	action: function(){
		this.render('hiring');
	}
});

Router.route('/world', {
	waitOn: function() {
        return [];
	},
	onBeforeAction: function() {
		animStart = true;
		animStartDep.changed();
		this.next();
	},
	action: function(){
		this.render('world');
	}
});

Router.route('/leaderboard', {
	waitOn: function() {
        return [];
	},
	onBeforeAction: function() {
		animStart = false;
		animStartDep.changed();
		this.next();
	},
	action: function(){
		this.render('leaderboard');
	}
});