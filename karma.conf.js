module.exports = function (config) {
  config.set({
    frameworks: [
      'browserify',
      'jasmine',
    ],
    files: [
      'src/**/*.js',
    ],
    preprocessors: {
      'src/**/*.js': [
        'jshint',
        'jscs',
        'browserify',
      ],
    },
    browsers: [
      'PhantomJS',
    ],
    browserify: {
      debug: true,
      transform: [
        ['babelify', { presets: ['es2015'] }],
      ],
    },
    jscsPreprocessor: {
      configPath: '.jscsrc',
    },
    reporters: [
      'spec',
    ],
  })
}
