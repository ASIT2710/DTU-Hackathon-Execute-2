const {ddbDocClient} = require('./clients');
const constants = require('./constants');

const getAccountIdMapping = async (phone) => {
    console.log(`gettingAccountIdMapping for ${phone}, tbl: ${constants.userAccountIdMappingTable}`);
    const data = await ddbDocClient.get({
        TableName: constants.userAccountIdMappingTable,
        Key: { phone }
    }).promise()
    console.log(`accountIdMapping for ${phone} query result: ${JSON.stringify(data)}`);
    if ('Item' in data) {
        return data['Item'];
    }
    console.log(`accountIdMapping not found for phone ${phone}`);
    return null;
}

const addNewUserAccountRecord = async (data) => {
    await ddbDocClient.put({
        TableName: constants.accountTable,
        Item: {...data, 'currentActive': true, createdAt: Date.now()},
    }).promise();
}

const addNewUserAccountIdMapping = async (phone, newId) => {
    await ddbDocClient.put({
        TableName: constants.userAccountIdMappingTable,
        Item: {
            'phone': phone,
            'id': newId
        }
    }).promise()
}

module.exports = {
    getAccountIdMapping,
    addNewUserAccountRecord,
    addNewUserAccountIdMapping
}
