const { syntaxCheckFiles } = require('./context');
const { run } = require('./runner');

const checkSyntax = () => {
    for (const file of syntaxCheckFiles) {
        run(['-c', file], `syntax check ${file}`);
    }
};

module.exports = {
    checkSyntax
};
export {};
