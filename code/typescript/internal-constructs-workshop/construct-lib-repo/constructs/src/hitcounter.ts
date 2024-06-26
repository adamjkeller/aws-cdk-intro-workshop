import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';

import { Construct } from 'constructs';

export interface HitCounterProps {
  /** the function for which we want to count url hits **/
  readonly downstream: lambda.IFunction;

  /** the path to the hitcounter lambda directory. Doing it this way allows us to specify the path in the stack itself **/
  readonly hitcounterPath: string;
}

export class HitCounter extends Construct {
  /*_ allows accessing the counter function */
  public readonly handler: lambda.Function;

  /*_ the hit counter table */
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: HitCounterProps) {
    super(scope, id);

    const table = new dynamodb.Table(this, 'Hits', {
      partitionKey: { name: 'path', type: dynamodb.AttributeType.STRING },
    });
    this.table = table;

    this.handler = new lambda.Function(this, 'HitCounterHandler', {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'hitcounter.handler',
      code: lambda.Code.fromAsset(props.hitcounterPath),
      environment: {
        DOWNSTREAM_FUNCTION_NAME: props.downstream.functionName,
        HITS_TABLE_NAME: table.tableName,
      },
    });

    // grant the lambda role read/write permissions to our table
    table.grantReadWriteData(this.handler);

    // grant the lambda role invoke permissions to the downstream function
    props.downstream.grantInvoke(this.handler);

  }
}