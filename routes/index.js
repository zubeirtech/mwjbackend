const express = require('express');
const asyncHandler = require('express-async-handler');
const JSONAPIDeserializer = require('jsonapi-serializer').Deserializer;
const JSONAPISerializer = require('jsonapi-serializer').Serializer;
const bcrypt = require('bcrypt-nodejs');


const router = express.Router();


const PersonSerializer = new JSONAPISerializer('person', {
    attributes: [
        'name',
        'gender',
        'bmi',
        'goal',
        'unit',
        'dates',
        'height',
        'weights',
        'age',
    ],
});

// models
const User = require('../models/User');
const Person = require('../models/Person');

const getAccessToken = (req) => {
    const header = req.get('Authorization');
    const tokenarr = header.split(' ');
    return tokenarr[1];
};

// token route for auth
router.post('/token', asyncHandler(async (req, res, next) => {
    if (req.body.grant_type === 'password') {
        try {
            const { username, password } = req.body;
            await User.find({ email: username }, async (err, docs) => {
                if (docs.length !== 0) {
                    const findPerson = await Person.find({ email: username });
                    if (findPerson.length !== 0) {
                        bcrypt.compare(password, docs[0].password, (error, val) => {
                            if (error) {
                                next(error);
                            }
                            if (val) {
                            /* eslint-disable no-underscore-dangle */
                                res.status(200).send(`{ "access_token": "${findPerson[0]._id}"}`);
                                next();
                            } else {
                                res.status(400).send('{"error": "invalid_grant"}');
                                next();
                            }
                        });
                    }
                } else {
                    res.status(400).send('{"error": "invalid_grant"}');
                    next();
                }
            });
        } catch (error) {
            next(error);
        }
    } else {
        res.status(400).send('{ "error": "unsupported_grant_type" }');
    }
}));

// router for registering new user
router.post('/users', asyncHandler((req, res, next) => {
    new JSONAPIDeserializer().deserialize(req.body, async (err, user) => {
        try {
            if (user) {
                const { username, email } = user;
                let { password } = user;

                const findUser = await User.find({ email });

                if (findUser.length > 0) {
                    // pass
                    res.status(201).send('"message": "Email exists"');
                    next();
                } else {
                    bcrypt.genSalt(10, (e, salt) => {
                        if (e) {
                            console.log(e);
                        }
                        bcrypt.hash(password, salt, null, async (error, hash) => {
                            if (error) {
                                next(error);
                            }
                            password = hash;

                            const newUser = new User({
                                username,
                                email,
                                password,
                            });

                            const newPerson = new Person({
                                email,
                            });


                            const saveUser = await newUser.save();
                            const savePerson = await newPerson.save();

                            if (saveUser && savePerson) {
                                const personJson = PersonSerializer.serialize(savePerson);
                                res.status(200).json(personJson);
                                next();
                            }
                        });
                    });
                }
            } else {
                console.log(err);
                res.status(500).send(err);
                next();
            }
        } catch (error) {
            next(error);
        }
    });
}));

router.get('/people', asyncHandler(async (req, res, next) => {
    try {
        const id = getAccessToken(req);
        const docs = await Person.find({ _id: id });

        if (docs.length > 0) {
            const personDocs = docs[0];
            const personsJson = PersonSerializer.serialize(personDocs);
            res.status(200).send(personsJson);
            next();
        } else {
            const person = new Person({});
            await person.save();
            const personsJson = PersonSerializer.serialize(person);
            res.status(200).send(personsJson);
            next();
        }
    } catch (error) {
        next(error);
    }
}));

router.patch('/people/:id', asyncHandler(async (req, res, next) => {
    try {
        new JSONAPIDeserializer().deserialize(req.body, async (err, person) => {
            const {
                id,
                name,
                gender,
                bmi,
                goal,
                unit,
                dates,
                height,
                weights,
                age,
            } = person;

            const doc = await Person.findById(id);
            if (!doc) {
                const newPerson = new Person({});
                await person.save();
                const personsJson = PersonSerializer.serialize(newPerson);
                res.status(200).send(personsJson);
                next();
            } else {
                doc.name = name;
                doc.gender = gender;
                doc.bmi = bmi;
                doc.goal = goal;
                doc.unit = unit;
                doc.dates = dates;
                doc.height = height;
                doc.weights = weights;
                doc.age = age;

                await doc.save();

                const personJson = PersonSerializer.serialize(doc);
                res.status(200).send(personJson);
                next();
            }
        });
    } catch (error) {
        next(error);
    }
}));

module.exports = router;
