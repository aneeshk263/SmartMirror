const exec = require('child_process').exec;

const speaker = require('./speech/amazon-polly-speaker');
const requestHelper = require('./util/request_helper');
const articleExtractor = require('./util/article_extractor');
const serialHandler = require('./util/serial_handler');
var nodeSkanetraiken = require('node-skanetrafiken');
const moment = require('moment');

module.exports = (app, mirrorSocket) => {

	app.get('/api/brightness/:val', (req, res) => {
		console.log(req.params.val);
		if(req.params.cmd) serialHandler.writeString('brightness:' + req.params.val);
		res.redirect("/app");
	});

	app.get('/api/brightnessUp', (req, res) => {
    serialHandler.writeString('brightnessUp:');
    res.redirect("/app");
  });

	app.get('/api/brightnessDown', (req, res) => {
    serialHandler.writeString('brightnessDown:');
    res.redirect("/app");
  });

	app.get('/api/serial/:command', (req, res) => {
		let serialCommand, hour, min;
		let command = req.params.command;
		if (command.includes("time")) {
			serialCommand = command.split(":time=")[0];
			const hhmm = command.split(":time=")[1];
			hour = hhmm.split(":")[0];
			min = hhmm.split(":")[1];
			let now = moment(new Date());
			let future = moment(new Date()).hour(hour).minute(min);
			let diff = future.diff(now);
			if (diff < 0) {
				future.add(1, 'day');
			}
			diff = future.diff(now);
			setTimeout(() => {
				serialHandler.writeString(serialCommand)
			}, diff);
		} else {
			serialHandler.writeString(req.params.command);
		}
	  res.redirect("/app");
	});
	

	app.post('/api/serial', (req, res) => {
		if(req.body.mode){
			const mode = req.body.mode;
			const speed = req.body.speed;
			serialHandler.writeString('mode:' + req.body.mode + ':' + req.body.speed);
		} else {
	    const side = req.body.side;
	    const rgb = req.body.rgb;
	   	if(side === 'all'){
	   		serialHandler.writeString('rgb:' + rgb.r + ':' + rgb.g + ':' + rgb.b);
	   	} else {
	   		serialHandler.writeString('side:' + side + ':' + rgb.r + ':' + rgb.g + ':' + rgb.b);
	   	}
	  }
	  res.redirect("/app");
	});

	app.get('/api/speak/:text', (req, res) => {
	  if (req.params.text) speaker.speak(req.params.text);
	  res.redirect("/app");
	});

	app.get('/api/hide', (req, res) => {
	  mirrorSocket.sendToClient('visibility', {component: 'forecasts', visible: false});
	  mirrorSocket.sendToClient('visibility', {component: 'news', visible: false});
	  mirrorSocket.sendToClient('visibility', {component: 'article', visible: false});
	  mirrorSocket.sendToClient('visibility', {component: 'tasks', visible: false});
	  mirrorSocket.sendToClient('visibility', {component: 'weather', visible: false});
	  mirrorSocket.sendToClient('visibility', {component: 'clock', visible: false});

	  res.redirect("/app");

	});

	app.get('/api/hide/:component', (req, res) => {
	  mirrorSocket.sendToClient('visibility', {component: req.params.component, visible: false});
   	res.redirect("/app");
	});

	app.get('/api/show/:component', (req, res) => {
	  mirrorSocket.sendToClient('visibility', {component: req.params.component, visible: true});
	  res.redirect("/app");
	});


	app.get('/api/show', (req, res) => {
	  mirrorSocket.sendToClient('visibility', {component: 'forecasts', visible: true});
	  mirrorSocket.sendToClient('visibility', {component: 'news', visible: true});
	  mirrorSocket.sendToClient('visibility', {component: 'article', visible: false});
	  mirrorSocket.sendToClient('visibility', {component: 'tasks', visible: true});
	  mirrorSocket.sendToClient('visibility', {component: 'weather', visible: true});
	  mirrorSocket.sendToClient('visibility', {component: 'clock', visible: true});

	  res.json({
	      success: true
	    });
	});

	app.get('/api/tasks', (req, res) => {
		requestHelper.getTasks((tasks) => {
	    res.json({
	      tasks: tasks
	    });
		return;
	  })
	});

	app.get('/api/tasks/create/:title', (req, res) => {
		if(req.params.title){
			requestHelper.createTask(req.params.title)
	    res.json({
	      success: true
	    });
		} else {
			res.json({
	      success: false
	    });
		}
	});

	app.get('/api/articles', (req, res) => {
		articleExtractor.getArticles((articles) => {
	    res.json({
	      articles
	    });
		return;
	  })
	});

	app.get('/api/temperatures7days', (req, res) => {
		requestHelper.getTemperatures((temps) => {
	    res.json({
	      temperatures: temps
	    });
		return;
	  })
	});

	app.get('/api/shutdown', (req, res) => {
		exec("sudo shutdown -h now");
    res.redirect("/app");
	});

	app.get('/api/sleep', (req, res) => {
		exec("sudo tvservice -o");
    res.redirect("/app");
	});

	app.get('/api/wakeup', (req, res) => {
		exec("sudo tvservice -p; sudo chvt 6; sudo chvt 7;");
    res.redirect("/app");
	});

	app.get('/api/reboot', (req, res) => {
		exec("sudo reboot");
    res.redirect("/app");
	});

	app.get('/api/next', (req, res) => {
	  mirrorSocket.sendToClient('command', {component: 'article', action: 'next'});
	  res.redirect("/app");
	});

	app.get('/api/spotify/current', (req, res) => {
		requestHelper.getCurrentlyPlayingSpotify((playing) => {
			console.log("Playing", playing);
			if (!playing) return res.status(500).send({ error: 'Token to old, queries new. Please try again.'})
			res.json({
				currentPlaying: playing,
	    });
		});
	});

	app.get('/api/forecast', (req, res) => {
		requestHelper.getForecast((forecast) => {
	    res.json({
	      forecast: forecast
	    });
		return;
	  })
	});

	app.get('/api/journey', (req, res) => {
		const lundC = {
		  id: '81216' ,
		  name: 'Lund C' ,
		  type: '0' ,
		};

		const malmoC = {
		  id: '80000',
		  name: 'Malmö C',
		  type: '0',
		}

		nodeSkanetraiken.getJourneys({ from: lundC, to: malmoC, limit: 5, action: 'next' }, function(results, err) {
			//console.log("called")
	    if (!err) {
        //results.forEach((r) => console.log(r));
        return res.json({
        	routes: results
        });
	    } else {
	    	return res.json({ error: 'Could not featch bus/trains' });
	    }
		});
	});
}
