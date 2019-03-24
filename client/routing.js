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
		this.render('game');
		this.render('', {to: 'visiting'});
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
		this.render('game');
		// this.render('management');
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
		this.render('game');
		this.render('gathering', {to: 'visiting'});
		// this.render('gathering');
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
		this.render('game');
		this.render('production', {to: 'visiting'});
		// this.render('production');
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
		this.render('game');
		this.render('hiring', {to: 'visiting'});
		// this.render('hiring');
	}
});

Router.route('/town', {
	waitOn: function() {
        return [];
	},
	onBeforeAction: function() {
		animStart = true;
		animStartDep.changed();
		this.next();
	},
	action: function(){
		this.render('game');
		this.render('town', {to: 'visiting'});
		// this.render('town');
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
		this.render('game');
		// this.render('leaderboard');
	}
});