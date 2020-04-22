import App from "./App";

var port = process.env.HTTP_PORT || 9000;
console.log("Web App listening on port " + port);
App.listen(port);