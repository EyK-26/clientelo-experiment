import type {Migration} from '@getstrata/core/database/migrations/types';
import {Schema,resolveDatabaseDriver} from '@getstrata/core/database/schema';
const migration:Migration={
 name:'0010_experiment_lead',
 async up(db){await Schema.run(db,resolveDatabaseDriver(),schema=>{schema.create('experiment_lead',t=>{
  t.uuid('id').primary();t.string('email',254).unique();t.text('status').default('pending').check("status IN ('pending','sending','sent','failed','uncertain')");
  t.integer('attempts').default(0).check('attempts BETWEEN 0 AND 2');t.text('provider_id').nullable();t.text('resource_version').default('checklist-v1');
  t.timestamp('created_at').defaultRaw('NOW()');t.timestamp('updated_at').defaultRaw('NOW()');
 });});},
 async down(db){await Schema.run(db,resolveDatabaseDriver(),schema=>{schema.drop('experiment_lead');});},
};export default migration;
