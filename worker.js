const {randomUUID} = require('crypto');
const {
    sendSms,
    deleteReadMessage
} = require('./utils');
const {
    getAccountIdMapping,
    addNewUserAccountRecord,
    addNewUserAccountIdMapping,
} = require("./dal");

const handleRegisterNewAccount = async (phone, pan, name, location) => {
    console.log(`registering new account for ${phone}, ${pan}, ${name}, ${location}`);
    const account = await getAccountIdMapping(phone)
    if (account === null) {
        const newId = randomUUID();
        await addNewUserAccountRecord({
            'phone': phone.toPhoneNumberDbKey(),
            'id': newId,
            'name': name,
            'loc': location,
            'pan': pan,
            'verification': 'hard',
            'balance': 0,
            'currentActive': true,
            'createdAt': Date.now(),
        })
        await addNewUserAccountIdMapping(phone, newId)
        console.log(`New account registered for phone: ${phone} account id: ${newId}`)
        await sendSms(phone, 'NEW ACCOUNT REGISTER SUCCESS')
    } else {
        console.log(`user account for ${phone} already exists`)
    }
}

exports.handler = async (event) => {
    Object.freeze(event);
    const prefix = process.env.PREFIX || constants.prefix;

    console.log(`received message from sqs: ${JSON.stringify(event)}`)

    // delete messages from sqs
    await deleteReadMessage(event['Records'])

    // process received messages
    for (const record of event['Records']) {
        const body = JSON.parse(record.body);
        const sender = body['sender'];
        const message =
            body['content'].replace(`${prefix} `, ''); // strip sms prefix
        console.log(`sender: ${sender} | parsed message: ${message}`)
        if (message.startsWith('REGISTER')) {
            const splitted = message.replace('REGISTER ', '').split(' ')
            const pan = splitted[0]
            const name = splitted[1]
            const location = splitted[2]
            await handleRegisterNewAccount(
                sender.toPhoneNumberDbKey(),
                pan,
                name,
                location
            )
            return;
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify('ok'),
    };
};
