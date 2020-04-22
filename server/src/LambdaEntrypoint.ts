'use strict'
import * as awsServerlessExpress from "aws-serverless-express";
import App from "./App";
const server = awsServerlessExpress.createServer(App);

exports.handler = (event, context) => { awsServerlessExpress.proxy(server, event, context) };