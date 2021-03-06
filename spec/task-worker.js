/*global module,require,global*/
(function testing() {
  'use strict';

  const code = require('code')
    , amqp = require('amqplib')
    , lab = require('lab').script()
    , describe = lab.describe
    , it = lab.it
    , before = lab.before
    , after = lab.after
    , expect = code.expect
    , testingConfigurations = require('./test.json')
    , nodeAmqp = require('..')
    , Task = nodeAmqp.Task
    , Worker = nodeAmqp.Worker
    , exchangedMessage = JSON.stringify({
      'first': 'first'
    })
    , secondExchangedMessage = JSON.stringify({
      'second': 'second'
    })
    , retryTimeoutMillisec = 20;

  describe('node-amqp task talks to worker', () => {
    const task = new Task(testingConfigurations)
      , worker = new Worker(testingConfigurations);
    let taskFinished = false
      , workerFinished = false;

    task.on('amqp:ready', () => {

      if (!taskFinished) {

        taskFinished = true;
      }
    });

    worker.on('amqp:ready', () => {

      if (!workerFinished) {

        workerFinished = true;
      }
    });

    task.on('amqp:connection-closed', () => {

      if (taskFinished) {

        taskFinished = false;
      }
    });

    worker.on('amqp:connection-closed', () => {

      if (workerFinished) {

        workerFinished = false;
      }
    });

    before(done => {
      const onTimeoutTrigger = () => {

        if (workerFinished &&
          taskFinished) {

          done();
        } else {

          global.setTimeout(onTimeoutTrigger, retryTimeoutMillisec);
        }
      };

      onTimeoutTrigger();
    });

    after(done => {
      const onTimeoutTrigger = () => {

        if (!workerFinished &&
          !taskFinished) {

          amqp.connect(testingConfigurations.host, testingConfigurations.socketOptions)
          .then(connection => {

            return connection.createChannel();
          })
          .then(channel => {

            channel.deleteQueue(testingConfigurations.queueName)
            .then(() => {

              channel.connection.close();
              done();
            });
          });
        } else {

          global.setTimeout(onTimeoutTrigger, retryTimeoutMillisec);
        }
      };

      onTimeoutTrigger();
      task.closeConnection();
      worker.closeConnection();
    });

    it('should send and manage a message', done => {

      worker.consume()
      .then(message => {
        worker.cancelConsumer();
        const messageArrived = message.content.toString();

        expect(messageArrived).to.be.equal(exchangedMessage);
        done();
      })
      .catch(err => {

        done(err);
      });

      task.send(exchangedMessage);
    });

    it('should send and get a message', done => {

      worker.receive()
      .then(message => {

        expect(message).to.be.equal(false);
        task.send(secondExchangedMessage);
        global.setTimeout(() => {

          worker.receive()
          .then(anotherMsg => {
            const messageArrived = anotherMsg.content.toString();

            expect(messageArrived).to.be.equal(secondExchangedMessage);
            done();
          })
          .catch(err => {

            done(err);
          });
        }, 0);
      })
      .catch(err => {

        done(err);
      });
    });
  });

  module.exports = {
    lab
  };
}());
