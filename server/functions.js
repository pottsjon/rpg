workforceEvaluate = function () {
    const workforceCount = Workers.find({ owner: { $exists: false } },{ limit: 10 }).count();
    if ( workforceCount < 10 )
    workforceAdd();
};

workforceAdd = function () {
    Workers.insert({
        name: Fake.user().fullname,
    })
};