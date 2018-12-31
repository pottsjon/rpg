Template.registerHelper('toLowerCase', function(str) {
	return str.toLowerCase();
});

Template.registerHelper('toDollars', function(str) {
	return numeral(str).format('$0,0.[00]a');
});

Template.registerHelper('toNumbers', function(str) {
	return numeral(str).format('0,0.[00]a');
});