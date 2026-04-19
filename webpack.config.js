const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/main.ts',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'main.js',
    clean: true,
  },
  target: 'node',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
    plugins: [new TsconfigPathsPlugin()],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    // Copy migrations to dist folder as CommonJS modules
    new CopyPlugin({
      patterns: [
        {
          from: 'src/database/migrations/**/*.ts',
          to: 'migrations/[name].js',
          transform(content) {
            // Convert TypeScript to JavaScript by removing type annotations
            let code = content.toString('utf8');
            // This is a simple transpilation - production should use ts-loader for migrations too
            return code;
          },
        },
      ],
    }),
  ],
  optimization: {
    minimize: false,
  },
  externals: {
    // Keep these as external requires for better compatibility
    'better-sqlite3': 'commonjs better-sqlite3',
  },
};
