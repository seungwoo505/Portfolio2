const { createMessageHandler } = require('./handlers');
const {
    startReading,
    writeError,
    writeResult
} = require('./transport');

const handleMessage = createMessageHandler({
    writeError,
    writeResult
});

startReading(handleMessage);
