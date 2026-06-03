module.exports = {
    ...require('./queries'),
    ...require('./mutations'),
    ...require('./stats'),
    ...require('./rate-limit')
};
