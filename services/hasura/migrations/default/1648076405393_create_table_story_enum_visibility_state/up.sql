CREATE TABLE "story_enum"."visibility_state" ("state" text NOT NULL, "description" text NOT NULL, PRIMARY KEY ("state") );COMMENT ON TABLE "story_enum"."visibility_state" IS E'Enum table representing the visibility state of a given story';
