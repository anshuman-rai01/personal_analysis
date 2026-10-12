import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateDbEnv } from './envCheck.ts';

describe('validateDbEnv', () => {
  const validEnv: Record<string, string> = {
    SQL_HOST: 'localhost',
    SQL_PORT: '5432',
    SQL_USER: 'postgres',
    SQL_PASSWORD: 'super_secret_actual_password_123',
    SQL_DB_NAME: 'omnilife_dev',
  };

  it('passes on completely valid environment without problems', () => {
    const problems = validateDbEnv(validEnv);
    assert.deepEqual(problems, []);
  });

  it('passes with optional admin credentials if they are valid', () => {
    const problems = validateDbEnv({
      ...validEnv,
      SQL_ADMIN_USER: 'admin',
      SQL_ADMIN_PASSWORD: 'admin_real_password_456',
    });
    assert.deepEqual(problems, []);
  });

  it('flags missing required variables', () => {
    const problems = validateDbEnv({});
    assert.equal(problems.length, 4);
    assert.ok(problems.some((p) => p.includes('SQL_HOST')));
    assert.ok(problems.some((p) => p.includes('SQL_USER')));
    assert.ok(problems.some((p) => p.includes('SQL_PASSWORD')));
    assert.ok(problems.some((p) => p.includes('SQL_DB_NAME')));
  });

  it('flags empty strings as missing variables', () => {
    const problems = validateDbEnv({
      SQL_HOST: '   ',
      SQL_USER: '',
      SQL_PASSWORD: '',
      SQL_DB_NAME: '',
    });
    assert.equal(problems.length, 4);
  });

  it('flags placeholder values such as YOUR_PASSWORD, your_password_here, and CHANGE_ME', () => {
    const placeholderEnv = {
      SQL_HOST: 'localhost',
      SQL_PORT: '5432',
      SQL_USER: 'postgres',
      SQL_PASSWORD: 'YOUR_SQL_PASSWORD_HERE',
      SQL_DB_NAME: 'CHANGE_ME',
      SQL_ADMIN_PASSWORD: 'your_password_here',
    };

    const problems = validateDbEnv(placeholderEnv);
    assert.ok(problems.some((p) => p.includes('SQL_PASSWORD') && p.includes('placeholder')));
    assert.ok(problems.some((p) => p.includes('SQL_DB_NAME') && p.includes('placeholder')));
    assert.ok(problems.some((p) => p.includes('SQL_ADMIN_PASSWORD') && p.includes('placeholder')));
  });

  it('flags placeholder values starting with MY_ or CHANGEME', () => {
    const env = {
      SQL_HOST: 'localhost',
      SQL_USER: 'postgres',
      SQL_PASSWORD: 'MY_SECRET_PASS',
      SQL_DB_NAME: 'CHANGEME',
    };

    const problems = validateDbEnv(env);
    assert.ok(problems.some((p) => p.includes('SQL_PASSWORD') && p.includes('placeholder')));
    assert.ok(problems.some((p) => p.includes('SQL_DB_NAME') && p.includes('placeholder')));
  });

  it('flags invalid port numbers', () => {
    const env = {
      ...validEnv,
      SQL_PORT: 'not_a_number',
    };
    const problems = validateDbEnv(env);
    assert.ok(problems.some((p) => p.includes('SQL_PORT')));
  });

  it('never leaks secret or placeholder values in returned problem messages', () => {
    const secrets = [
      'SUPER_SECRET_VALUE_DO_NOT_LEAK',
      'YOUR_SQL_PASSWORD_HERE',
      'CHANGE_ME_NOW',
      'PASSWORD_HERE_SECRET',
      'MY_HIDDEN_CREDENTIAL',
    ];

    const secretEnv = {
      SQL_HOST: secrets[0],
      SQL_PORT: '5432',
      SQL_USER: 'postgres',
      SQL_PASSWORD: secrets[1],
      SQL_DB_NAME: secrets[2],
      SQL_ADMIN_USER: secrets[3],
      SQL_ADMIN_PASSWORD: secrets[4],
    };

    const problems = validateDbEnv(secretEnv);
    assert.ok(problems.length > 0);

    for (const problem of problems) {
      for (const secret of secrets) {
        assert.equal(
          problem.includes(secret),
          false,
          `Problem message "${problem}" must NOT contain secret value "${secret}"`
        );
      }
    }
  });

  it('flags missing admin credentials when requireAdmin is true', () => {
    const problems = validateDbEnv(validEnv, { requireAdmin: true });
    assert.ok(problems.some((p) => p.includes('SQL_ADMIN_USER')));
    assert.ok(problems.some((p) => p.includes('SQL_ADMIN_PASSWORD')));
  });
});
