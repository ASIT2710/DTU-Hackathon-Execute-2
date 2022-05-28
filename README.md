# Rainbow bank
An offline & mobile first neo-bank for business owners.

Built for: DTU-Hackathon-Execute-2

## Db schema
- table: `khata`
```
id (pk)
creditorPhone
debtorPhone
money
op (credit, paid)
note
openingBalance
createdAt
```

- table: `creditHistory`
```
creditorPhone:debtorPhone (pk)
balance
```

- table `creditTotal` 
```
creditorPhone (pk)
balance
```

- table `debtTotal`
```
debtorPhone (pk)
balance
```

- table `debtHistory`
```
debtorPhone:creditorPhone (pk)
balance
```

- table: `userAccountIdMapping`
```
phone (pk)
id
```

- table: `userAccount`
```
id (pk)
name
phone
loc
pan
verification
balance
currentActive
createdAt
 ```

- table: `userTxn`
```
txnId (pk)
firstParty
secondParty
requestType
money
status
createdAt
currentActive
```

- table: `floatingCashRequest`
  indicates latest ask for floating cash request id
```
phone(pk)
id
```

- table: `userRequest`
```
id (pk)
phone
requestType
where
money
otherAccount
status
extraInfo
currentActive
createdAt
```

- table: `userAccountLedger`
```
id (pk)
phone
op
note
money
openingBalance
createdAt
```

- table `userBucket`
```
phoneWithBucketName (pk)
balance
```
---
## Docs
- [Dynamodb document client](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/dynamodb-example-document-client.html)
- Setup awscli for deploy script `deploy.sh`:
```
python3 -m venv .venv
.venv/bin/pip install awscli
```
- To build & deploy:

sink (receive incoming sms)
```shell
./deploy.sh sink
```

worker (process sms)
```shell
./deploy.sh worker
```

---
## AWS Shenanigans
**Note:** If `elasticache` is in private subnet
- Lambda function needs to be inside vpc and must be associated with privates subnets same as `elasticache`
- AWS VPC endpoints needs to be setup for - `SQS` & `DynamoDB`, since requests for these services travels through internet
- Environment variables (Key: Value), needs to be set for lambda functions:
```shell
ACCESS_KEY_ID:	---
QUEUE_URL:	https://---.fifo
REDIS_ENDPOINT:	redis://---.aps1.cache.amazonaws.com:6379
REGION:	ap-south-1
SECRET_ACCESS_KEY:	---
```
- Modify config: timeout to 30seconds at least, Memory to 256mb
- Add follwing policies to the role (not ideal setup, just a shotgun approach):
```shell
AWSLambdaBasicExecutionRole-64...ef	(already exist, add the remaining 👇)
AmazonSQSFullAccess
AmazonElastiCacheFullAccess
AmazonDynamoDBFullAccess
AWSLambdaDynamoDBExecutionRole
AdministratorAccess
AWSLambdaSQSQueueExecutionRole
AWSLambdaInvocation-DynamoDB
AWSLambdaVPCAccessExecutionRole
```
---
## Tests checklist (manual)
- [ ] Register new account
- [ ] Collect cash from customers using agents
- [ ] ATM Deposit
- [ ] ATM Withdraw
- [ ] Pay vendor
- [ ] Transfer money
- [ ] Create & update bucket
- [ ] See account balance
- [ ] See bucket balance
- [ ] Find ATM for deposit
- [ ] Find ATM for withdrawal
- [ ] Register credit
- [ ] Partial cash collection
- [ ] Checking history and balance of credits and debt
