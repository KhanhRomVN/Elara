const config = {
  extends: ['@commitlint/config-conventional', '@commitlint/cli'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation changes
        'style', // Formatting (no code change)
        'refactor', // Code refactoring (no new feature or bug fix)
        'test', // Adding or modifying tests
        'perf', // Performance improvements
        'ci', // CI/CD configuration changes
        'chore', // Misc. tasks (e.g., build process, tools)
        'build', // Changes that affect the build system or dependencies
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
  },

  ignores: [(commit) => commit === ''],
};

module.exports = config;
