const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const runLogger = (mode, errorCode = 'ENOSPC') => {
    const child = spawnSync(process.execPath, [
        '--import', 'tsx', path.join(__dirname, 'helpers', 'logger-error-process.js'), mode, errorCode
    ], {
        cwd: path.resolve(__dirname, '..'),
        encoding: 'utf8',
        timeout: 10000,
        env: { ...process.env, LOG_LEVEL: 'info' }
    });
    const serialized = child.stdout.match(/LOGGER_RESULT:(.+)/);
    return { ...child, result: serialized ? JSON.parse(serialized[1]) : null };
};

for (const code of ['ENOSPC', 'EACCES']) {
    test(`로그 파일 쓰기가 ${code}로 실패해도 프로세스와 이후 콘솔 기록이 유지된다`, () => {
        const child = runLogger('write-error', code);
        assert.equal(child.status, 0, child.stderr);
        assert.equal(child.result?.survived, true);
        assert.match(child.stderr, new RegExp(code));
        assert.match(child.stdout, /INFO console-after-error req=req-after/);
    });
}

for (const mode of ['transport-error', 'logger-error']) {
    test(`${mode} 오류가 재방출되어도 프로세스가 유지되고 오류는 한 번 보고된다`, () => {
        const child = runLogger(mode);
        assert.equal(child.status, 0, child.stderr);
        assert.equal(child.result?.survived, true);
        assert.equal(child.stderr.match(/log storage ENOSPC/g)?.length, 1, child.stderr);
        assert.match(child.stdout, /INFO console-after-error req=req-after/);
    });
}

test('로그 디렉터리와 파일 초기화 실패는 미처리 거부 없이 콘솔 기록으로 복구한다', () => {
    const child = runLogger('initialization-error', 'EACCES');
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.result?.survived, true);
    assert.match(child.stderr, /EACCES/);
    assert.match(child.stdout, /INFO console-after-error req=req-after/);
});

test('로그 오류 보고용 콘솔이 실패해도 stderr로 보고하고 계속 실행한다', () => {
    const child = runLogger('console-error');
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.result?.survived, true);
    assert.match(child.stderr, /ENOSPC/);
});

test('정상 로그는 기존 포맷으로 콘솔과 파일 스트림에 모두 기록된다', () => {
    const child = runLogger('healthy');
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.result?.survived, true);
    assert.equal(child.stderr, '');
    assert.match(child.result.output, /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} INFO file-and-console req=req-file/);
    assert.match(child.stdout, /INFO file-and-console req=req-file/);
    assert.match(child.result.output, /INFO console-after-error req=req-after/);
});
