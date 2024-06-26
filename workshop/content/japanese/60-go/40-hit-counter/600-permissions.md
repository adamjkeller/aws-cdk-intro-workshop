+++
title = "Granting permissions"
weight = 600
+++

## Allow Lambda to read/write our DynamoDB table

Let's give our Lambda's execution role permissions to read/write from our table.

Go back to `hitcounter.go` and add the following highlighted lines:

{{<highlight go "hl_lines=41">}}
package hitcounter

import (
  "github.com/aws/aws-cdk-go/awscdk/v2/awsdynamodb"
  "github.com/aws/aws-cdk-go/awscdk/v2/awslambda"
  "github.com/aws/constructs-go/constructs/v10"
  "github.com/aws/jsii-runtime-go"
)

type HitCounterProps struct {
  Downstream awslambda.IFunction
}

type hitCounter struct {
  constructs.Construct
  handler awslambda.IFunction
}

type HitCounter interface {
  constructs.Construct
  Handler() awslambda.IFunction
}

func NewHitCounter(scope constructs.Construct, id string, props *HitCounterProps) HitCounter {
  this := constructs.NewConstruct(scope, &id)

  table := awsdynamodb.NewTable(this, jsii.String("Hits"), &awsdynamodb.TableProps{
    PartitionKey: &awsdynamodb.Attribute{Name: jsii.String("path"), Type: awsdynamodb.AttributeType_STRING},
  })

  handler := awslambda.NewFunction(this, jsii.String("HitCounterHandler"), &awslambda.FunctionProps{
    Runtime: awslambda.Runtime_NODEJS_16_X(),
    Handler: jsii.String("hitcounter.handler"),
    Code:    awslambda.Code_FromAsset(jsii.String("lambda"), nil),
    Environment: &map[string]*string{
      "DOWNSTREAM_FUNCTION_NAME": props.Downstream.FunctionName(),
      "HITS_TABLE_NAME":          table.TableName(),
    },
  })

  table.GrantReadWriteData(handler)

  return &hitCounter{this, handler}
}

func (h *hitCounter) Handler() awslambda.IFunction {
  return h.handler
}
{{</highlight>}}

## Deploy

Save & deploy:

```
cdk deploy
```

## Test again

Okay, deployment is complete. Let's run our test again (either use `curl` or
your web browser):

```
curl -i https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/
```

Again?

```
HTTP/2 502 Bad Gateway
...

{"message": "Internal server error"}
```

# 😢

Still getting this pesky 5xx error! Let's look at our CloudWatch logs again
(click "Refresh"):

```json
{
    "errorMessage": "User: arn:aws:sts::585695036304:assumed-role/CdkWorkshopStack-HelloHitCounterHitCounterHandlerS-TU5M09L1UBID/CdkWorkshopStack-HelloHitCounterHitCounterHandlerD-144HVUNEWRWEO is not authorized to perform: lambda:InvokeFunction on resource: arn:aws:lambda:us-east-1:585695036304:function:CdkWorkshopStack-HelloHandler2E4FBA4D-149MVAO4969O7",
    "errorType": "AccessDeniedException",
    "stackTrace": [
        "Object.extractError (/var/runtime/node_modules/aws-sdk/lib/protocol/json.js:48:27)",
        "Request.extractError (/var/runtime/node_modules/aws-sdk/lib/protocol/rest_json.js:52:8)",
        "Request.callListeners (/var/runtime/node_modules/aws-sdk/lib/sequential_executor.js:105:20)",
        "Request.emit (/var/runtime/node_modules/aws-sdk/lib/sequential_executor.js:77:10)",
        "Request.emit (/var/runtime/node_modules/aws-sdk/lib/request.js:683:14)",
        "Request.transition (/var/runtime/node_modules/aws-sdk/lib/request.js:22:10)",
        "AcceptorStateMachine.runTo (/var/runtime/node_modules/aws-sdk/lib/state_machine.js:14:12)",
        "/var/runtime/node_modules/aws-sdk/lib/state_machine.js:26:10",
        "Request.<anonymous> (/var/runtime/node_modules/aws-sdk/lib/request.js:38:9)",
        "Request.<anonymous> (/var/runtime/node_modules/aws-sdk/lib/request.js:685:12)"
    ]
}
```

Another access denied, but this time, if you take a close look:

```
User: <VERY-LONG-STRING> is not authorized to perform: lambda:InvokeFunction on resource: <VERY-LONG-STRING>"
```

So it seems like our hit counter actually managed to write to the database. We can confirm by
going to the [DynamoDB Console](https://console.aws.amazon.com/dynamodb/home):

![](./logs5.png)

But, we must also give our hit counter permissions to invoke the downstream lambda function.

## Grant invoke permissions

Add the highlighted lines to `hitcounter.go`:

{{<highlight go "hl_lines=43">}}
package hitcounter

import (
  "github.com/aws/aws-cdk-go/awscdk/v2/awsdynamodb"
  "github.com/aws/aws-cdk-go/awscdk/v2/awslambda"
  "github.com/aws/constructs-go/constructs/v10"
  "github.com/aws/jsii-runtime-go"
)

type HitCounterProps struct {
  Downstream awslambda.IFunction
}

type hitCounter struct {
  constructs.Construct
  handler awslambda.IFunction
}

type HitCounter interface {
  constructs.Construct
  Handler() awslambda.IFunction
}

func NewHitCounter(scope constructs.Construct, id string, props *HitCounterProps) HitCounter {
  this := constructs.NewConstruct(scope, &id)

  table := awsdynamodb.NewTable(this, jsii.String("Hits"), &awsdynamodb.TableProps{
    PartitionKey: &awsdynamodb.Attribute{Name: jsii.String("path"), Type: awsdynamodb.AttributeType_STRING},
  })

  handler := awslambda.NewFunction(this, jsii.String("HitCounterHandler"), &awslambda.FunctionProps{
    Runtime: awslambda.Runtime_NODEJS_16_X(),
    Handler: jsii.String("hitcounter.handler"),
    Code:    awslambda.Code_FromAsset(jsii.String("lambda"), nil),
    Environment: &map[string]*string{
      "DOWNSTREAM_FUNCTION_NAME": props.Downstream.FunctionName(),
      "HITS_TABLE_NAME":          table.TableName(),
    },
  })

  table.GrantReadWriteData(handler)

  props.Downstream.GrantInvoke(handler)

  return &hitCounter{this, handler}
}

func (h *hitCounter) Handler() awslambda.IFunction {
  return h.handler
}
{{</highlight>}}

## Diff

You can check what this did using `cdk diff`:

```
cdk diff
```

The **Resource** section should look something like this,
which shows the IAM statement was added to the role:

```
Resources
[~] AWS::IAM::Policy HelloHitCounter/HitCounterHandler/ServiceRole/DefaultPolicy HelloHitCounterHitCounterHandlerServiceRoleDefaultPolicy1487A60A
 └─ [~] PolicyDocument
     └─ [~] .Statement:
         └─ @@ -19,5 +19,15 @@
            [ ]         "Arn"
            [ ]       ]
            [ ]     }
            [+]   },
            [+]   {
            [+]     "Action": "lambda:InvokeFunction",
            [+]     "Effect": "Allow",
            [+]     "Resource": {
            [+]       "Fn::GetAtt": [
            [+]         "HelloHandler2E4FBA4D",
            [+]         "Arn"
            [+]       ]
            [+]     }
            [ ]   }
            [ ] ]
```

Which is exactly what we wanted.

## Deploy

Okay... let's give this another shot:

```
cdk deploy
```

Then hit your endpoint with `curl` or with your web browser:

```
curl -i https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/
```

Output should look like this:

```
HTTP/2 200 OK
...

Hello, CDK! You've hit /
```

> If you still get 5xx, give it a few seconds and try again. Sometimes API
Gateway takes a little bit to "flip" the endpoint to use the new deployment.

# 😲

{{< nextprevlinks >}}