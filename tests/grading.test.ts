import { describe, expect, it } from "vitest";
import { classOfDegree, scoreToGrade } from "@/lib/grading";

describe("scoreToGrade", () => {
  it("maps band boundaries exactly as the handbook publishes them", () => {
    expect(scoreToGrade(100)).toEqual({ grade: "A", point: 4.0 });
    expect(scoreToGrade(70)).toEqual({ grade: "A", point: 4.0 });
    expect(scoreToGrade(69.9)).toEqual({ grade: "B", point: 3.0 });
    expect(scoreToGrade(60)).toEqual({ grade: "B", point: 3.0 });
    expect(scoreToGrade(50)).toEqual({ grade: "C", point: 2.0 });
    expect(scoreToGrade(40)).toEqual({ grade: "D", point: 1.0 });
    expect(scoreToGrade(39.9)).toEqual({ grade: "F", point: 0.0 });
    expect(scoreToGrade(0)).toEqual({ grade: "F", point: 0.0 });
  });
});

describe("classOfDegree", () => {
  it("maps cumulative averages to degree classes at the published boundaries", () => {
    expect(classOfDegree(70)).toBe("First Class");
    expect(classOfDegree(69.99)).toBe("Second Class Upper");
    expect(classOfDegree(60)).toBe("Second Class Upper");
    expect(classOfDegree(50)).toBe("Second Class Lower");
    expect(classOfDegree(40)).toBe("Pass");
    expect(classOfDegree(39.9)).toBe("Fail");
  });
});
