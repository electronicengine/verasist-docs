import { withRunContract } from "./apiReferenceSpec";

test("old API gets documented run schema with a rollout gate", () => {
  const value = withRunContract({paths: {}, components: {schemas: {Unrelated: {type: "string"}}}});
  expect(value.paths["/api/v1/public/agent/workflow/{workflow_uuid}"].post["x-requires-api-update"]).toBe(true);
  expect(value.components.schemas.TriggerCallRequest.properties.run_type.anyOf[0].enum).toEqual(["voice", "video", "text"]);
  expect(value.components.schemas.Unrelated).toEqual({type: "string"});
});

test("updated API keeps its live contract and enables Try it", () => {
  const spec = { paths: {"/api/v1/public/agent/workflow/{workflow_uuid}": {post: {requestBody: {content: {"application/json": {schema: {$ref: "#/components/schemas/Run"}}}}}}}, components: {schemas: {Run: {properties: {run_type: {type: "string"}}}}}};
  expect(withRunContract(spec)).toBe(spec);
});
