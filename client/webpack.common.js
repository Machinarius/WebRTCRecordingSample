const path = require('path');

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      },
      {
        test: /\.scss$/,
        use: ["style-loader", "css-loader", "scss-loader"]
      }
    ],
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js', ".css", ".scss" ],
    alias: {
      videojs: 'video.js',
      WaveSurfer: 'wavesurfer.js',
      RecordRTC: 'recordrtc'
    }
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
};