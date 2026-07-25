module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.module.ts',
    '!**/*.controller.ts',
    '!**/main.ts',
    '!**/*.d.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  // Les tests d'automatisation AD accèdent à des vars d'env au chargement du module ;
  // on isole pour pouvoir ré-importer ad.ts avec ALLOW_REAL_AD activé.
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
