// The Blueprint course as data (plans/04-course-definition.md). Edit this file to change the
// course, then `pnpm course:publish blueprint --env <env>` writes a new version to D1.
//
// `key` is the lesson's stable id: progress and worksheets hang off it, so never renumber an
// existing key. The welcome is '00' and shows without a number. `file` is the object key in the
// private R2 bucket; it never reaches a student. Lesson copy is kept as written.
import type { CourseDefinition } from "../../src/shared/course.ts";

export const course: CourseDefinition = {
  id: "blueprint",
  title: "EnglishWind Blueprint",
  intro:
    "Twelve lessons on how English is actually acquired — and a daily system you can keep using long after the course ends.",
  modules: [
    {
      name: "Orientation",
      blurb: "Start here: what this course covers and how to use it.",
      lessons: [
        {
          key: "00",
          title: "Welcome & How to Use This Course",
          vimeoId: "1216572629",
          blurb:
            "Start here. What this course is, how the lessons fit together, and what to expect of yourself along the way: this is not grammar study, and progress takes longer to show than you would like. Before lesson 1, set up a notebook and decide when you will listen each day.",
          worksheets: [
            {
              label: "Welcome worksheet",
              file: "courses/blueprint/lesson-00.pdf",
            },
          ],
        },
      ],
    },
    {
      name: "Breaking the Old Mindset",
      blurb: "Why years of study never made you fluent.",
      lessons: [
        {
          key: "01",
          title: "Why You Still Can't Speak English",
          vimeoId: "1216727260",
          blurb:
            "You studied English for years and still freeze when you have to speak. That gap is not a sign of low ability — it is what the method produced. Before moving on, think back honestly over how you were taught, and what it actually asked you to do.",
          worksheets: [
            {
              label: "Lesson worksheet",
              file: "courses/blueprint/lesson-01.pdf",
            },
          ],
        },
        {
          key: "02",
          title: "Language Is a Skill, Not a Subject",
          vimeoId: "1216572628",
          blurb:
            "English is not a body of information to be memorised. It is a skill — closer to swimming or driving than to history — and you get it by doing it repeatedly, not by knowing about it. Swap the study mindset for an experience mindset.",
          worksheets: [],
        },
        {
          key: "03",
          title: "The Biggest Myths About Learning English",
          vimeoId: "1216572639",
          blurb:
            "Four beliefs that quietly hold learners back: that you must memorise difficult words, master grammar first, start speaking immediately, and sound like a native. Pick the one that has cost you the most, and stop following it.",
          worksheets: [
            {
              label: "Lesson worksheet",
              file: "courses/blueprint/lesson-03.pdf",
            },
          ],
        },
      ],
    },
    {
      name: "How Language Learning Really Works",
      blurb: "How you really learn a language: by understanding, not memorising.",
      lessons: [
        {
          key: "04",
          title: "Comprehensible Input Explained Simply",
          vimeoId: "1216572630",
          blurb:
            "The idea the rest of the course rests on: you acquire English by understanding messages pitched just above your current level — not by studying rules about them. Find one English resource that is easy enough to follow, and start there.",
          worksheets: [
            {
              label: "Lesson worksheet",
              file: "courses/blueprint/lesson-04.pdf",
            },
          ],
        },
        {
          key: "05",
          title: "Why Progress Feels Invisible at First",
          vimeoId: "1216572636",
          blurb:
            "There is a long stretch where you are improving and cannot tell, the same way a month at the gym shows nothing in the mirror. This quiet period is normal, and it is not failure. Keep listening through it — especially when nothing seems to be happening.",
          worksheets: [
            {
              label: "Lesson worksheet",
              file: "courses/blueprint/lesson-05.pdf",
            },
          ],
        },
        {
          key: "06",
          title: "Neuroplasticity and the English Brain",
          vimeoId: "1216572640",
          blurb:
            "Your brain builds English the way it builds anything else: by meeting the same patterns often enough that they stop feeling foreign. Most of what you call difficulty is really unfamiliarity. Choose one thing to listen to, and repeat it daily.",
          worksheets: [
            {
              label: "Lesson worksheet",
              file: "courses/blueprint/lesson-06.pdf",
            },
          ],
        },
      ],
    },
    {
      name: "Emotional & Psychological Barriers",
      blurb: "How to handle the fear of speaking and the days you feel unmotivated.",
      lessons: [
        {
          key: "07",
          title: "Why Fear Stops You from Speaking",
          vimeoId: "1216572637",
          blurb:
            "The blank feeling when someone asks you something in English is a stress response, not a gap in your knowledge — your body is treating the risk of a mistake as danger. Fear like that is normal. Take the pressure off performing, and the words come back.",
          worksheets: [
            {
              label: "Lesson worksheet",
              file: "courses/blueprint/lesson-07.pdf",
            },
          ],
        },
        {
          key: "08",
          title: "Motivation Is Not Enough",
          vimeoId: "1216727194",
          blurb:
            "Motivation is what starts you, and it always fades. What carries you is a habit small enough to survive a bad week. Build a fifteen-minute daily routine you can actually keep, and let consistency do what excitement cannot.",
          worksheets: [
            {
              label: "Lesson worksheet",
              file: "courses/blueprint/lesson-08.pdf",
            },
          ],
        },
      ],
    },
    {
      name: "Practical System",
      blurb: "A simple daily routine, the right content, and where grammar fits.",
      lessons: [
        {
          key: "09",
          title: "How to Build Daily English Immersion",
          vimeoId: "1216572645",
          blurb:
            "Immersion does not require leaving the country. Switch your phone to English, find channels you would have watched anyway, and let listening run in the background of things you already do. Build that environment once and it keeps working without you.",
          worksheets: [],
        },
        {
          key: "10",
          title: "Where Grammar Actually Fits",
          vimeoId: "1216572631",
          blurb:
            "Grammar is not the enemy — it is just in the wrong place. Rules land once you have heard the patterns enough to recognise them, which is why input has to come first. Notice the patterns as you listen instead of studying them ahead of time.",
          worksheets: [],
        },
        {
          key: "11",
          title: "How to Choose the Right English Content",
          vimeoId: "1216727005",
          blurb:
            "The practical version of picking your level: hard enough to teach you something, easy enough to follow without stopping every sentence. Cartoons, interviews, graded material and subtitles all qualify. Choose three sources you will actually return to.",
          worksheets: [],
        },
      ],
    },
    {
      name: "Conclusion & Next Step",
      blurb: "How to keep going after the course ends.",
      lessons: [
        {
          key: "12",
          title: "Your Long-Term English Learning Plan",
          vimeoId: "1216911220",
          blurb:
            "English is a long process, and the biggest risk from here is jumping to a new method every time this one feels slow. Consistent input beats a better plan you abandon. Write a thirty-day plan you can follow, and then follow it.",
          worksheets: [],
        },
      ],
    },
  ],
};

export default course;
