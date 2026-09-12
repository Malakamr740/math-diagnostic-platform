-- =========================================================================
-- SEED COMPLETE EST I MATH TAXONOMY (4 CONTENT DOMAINS & SKILLS)
-- =========================================================================

do $$
declare
  v_org_id uuid;
  v_exam_id uuid;
  v_subject_id uuid;
  
  -- Category IDs
  v_cat_alg uuid;
  v_cat_adv uuid;
  v_cat_psda uuid;
  v_cat_geom uuid;

  -- Chapter & Lesson IDs
  v_chap_id uuid;
  v_less_id uuid;
begin
  select id into v_org_id from organizations limit 1;
  if v_org_id is null then
    insert into organizations (name) values ('Primary Academy') returning id into v_org_id;
  end if;

  -- 1. Exam: EST I
  select id into v_exam_id from exams where organization_id = v_org_id and lower(name) = 'est i';
  if v_exam_id is null then
    insert into exams (organization_id, name, description)
    values (v_org_id, 'EST I', 'Egyptian Scholastic Test I')
    returning id into v_exam_id;
  end if;

  -- 2. Subject: Math
  select id into v_subject_id from subjects where exam_id = v_exam_id and lower(name) = 'math';
  if v_subject_id is null then
    insert into subjects (exam_id, name, description)
    values (v_exam_id, 'Math', 'EST I Mathematics Section')
    returning id into v_subject_id;
  end if;

  -- =======================================================================
  -- DOMAIN 1: ALGEBRA (~35%)
  -- =======================================================================
  select id into v_cat_alg from categories where subject_id = v_subject_id and lower(name) = 'algebra';
  if v_cat_alg is null then
    insert into categories (subject_id, name, description)
    values (v_subject_id, 'Algebra', 'Linear equations, inequalities, and functions')
    returning id into v_cat_alg;
  end if;

  -- Chapter: Linear Equations
  insert into chapters (category_id, name) values (v_cat_alg, 'Linear Equations') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Linear equations in one variable') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Creating and solving linear equations in one variable'),
    (v_less_id, 'Perimeter word problems and linear equations'),
    (v_less_id, 'Multi-step word problems with time and integer constraints'),
    (v_less_id, 'Solving multi-step linear equations with fractions');

  -- Chapter: Linear Functions
  insert into chapters (category_id, name) values (v_cat_alg, 'Linear Functions') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Linear functions') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Interpreting intercept values in linear models'),
    (v_less_id, 'Interpreting rate units and parameters in real-world contexts'),
    (v_less_id, 'Calculating slope from tables and finding missing values');

  -- Chapter: Linear Equations in Two Variables
  insert into chapters (category_id, name) values (v_cat_alg, 'Linear Equations in Two Variables') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Linear equations in two variables') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Determining slopes of parallel and perpendicular lines'),
    (v_less_id, 'Finding parameters and slopes from a given coordinate point');

  -- Chapter: Systems of Linear Equations
  insert into chapters (category_id, name) values (v_cat_alg, 'Systems of Linear Equations') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Systems of two linear equations in two variables') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Formulating and solving linear systems for word problems'),
    (v_less_id, 'Solving literal systems of linear equations');

  -- Chapter: Linear Inequalities
  insert into chapters (category_id, name) values (v_cat_alg, 'Linear Inequalities') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Linear inequalities in one or two variables') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Graphing and interpreting shaded linear inequality regions'),
    (v_less_id, 'Inequality properties and powers of numbers between 0 and 1'),
    (v_less_id, 'Modeling ranges and error tolerances with absolute value inequalities'),
    (v_less_id, 'Finding extreme values of linear expressions from inequality bounds');

  -- =======================================================================
  -- DOMAIN 2: ADVANCED MATH (~35%)
  -- =======================================================================
  select id into v_cat_adv from categories where subject_id = v_subject_id and lower(name) = 'advanced math';
  if v_cat_adv is null then
    insert into categories (subject_id, name, description)
    values (v_subject_id, 'Advanced Math', 'Nonlinear functions, quadratics, polynomials, and radicals')
    returning id into v_cat_adv;
  end if;

  -- Chapter: Equivalent Expressions
  insert into chapters (category_id, name) values (v_cat_adv, 'Equivalent Expressions') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Equivalent expressions') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Simplifying rational expressions and laws of exponents'),
    (v_less_id, 'Factoring quadratic polynomials with leading coefficients'),
    (v_less_id, 'Polynomial multiplication and determining specific term coefficients'),
    (v_less_id, 'Division and simplification of rational algebraic expressions'),
    (v_less_id, 'Solving exponential equations with rational powers'),
    (v_less_id, 'Simplifying radical expressions involving signed variables');

  -- Chapter: Nonlinear Equations
  insert into chapters (category_id, name) values (v_cat_adv, 'Nonlinear Equations') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Nonlinear equations in one variable') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Relating roots/factors to quadratic coefficients'),
    (v_less_id, 'Solving compound absolute value equations algebraically'),
    (v_less_id, 'Solving radical equations and isolating unknown constants'),
    (v_less_id, 'Determining real roots of cubic polynomials by grouping');

  -- Chapter: Nonlinear Functions
  insert into chapters (category_id, name) values (v_cat_adv, 'Nonlinear Functions') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Nonlinear functions') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Parabola symmetry, coordinates, and quadratic modeling'),
    (v_less_id, 'Identifying vertical and horizontal asymptotes of rational functions'),
    (v_less_id, 'Solving compound interest problems for initial principal'),
    (v_less_id, 'Hyperbola symmetry, asymptotes, and domain/range features'),
    (v_less_id, 'Evaluating combinations and polynomials of functions');

  -- =======================================================================
  -- DOMAIN 3: PROBLEM-SOLVING AND DATA ANALYSIS (~15%)
  -- =======================================================================
  select id into v_cat_psda from categories where subject_id = v_subject_id and lower(name) = 'problem-solving and data analysis';
  if v_cat_psda is null then
    insert into categories (subject_id, name, description)
    values (v_subject_id, 'Problem-Solving and Data Analysis', 'Quantitative reasoning, rates, percentages, and statistics')
    returning id into v_cat_psda;
  end if;

  -- Chapter: Ratios & Units
  insert into chapters (category_id, name) values (v_cat_psda, 'Ratios, Rates, and Units') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Ratios, rates, proportional relationships, and units') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Proportional distribution and pie chart analysis');

  -- Chapter: Percentages
  insert into chapters (category_id, name) values (v_cat_psda, 'Percentages') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Percentages') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Translating percentage expressions into linear algebraic models'),
    (v_less_id, 'Calculating weighted percentages across multiple categories'),
    (v_less_id, 'Calculating sequential percentages of a quantity');

  -- Chapter: One-Variable Statistics
  insert into chapters (category_id, name) values (v_cat_psda, 'One-Variable Statistics') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'One-variable data: distributions, measures of center and spread') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Interpreting axes and context from statistical bar graphs'),
    (v_less_id, 'Comparative analysis of dual-bar categorical charts'),
    (v_less_id, 'Extracting discrete data values from bar graphs'),
    (v_less_id, 'Filtering data and calculating differences between conditions'),
    (v_less_id, 'Identifying mode from cumulative frequency curves'),
    (v_less_id, 'Computing arithmetic mean from bar charts');

  -- Chapter: Two-Variable Statistics & Models
  insert into chapters (category_id, name) values (v_cat_psda, 'Two-Variable Statistics & Models') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Two-variable data: models and scatterplots') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Estimating values from scatterplot distributions');

  -- Chapter: Probability and Counting
  insert into chapters (category_id, name) values (v_cat_psda, 'Probability and Counting') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Probability and conditional probability') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Single-event probability and number theory properties'),
    (v_less_id, 'Multi-stage probability without replacement and permutations'),
    (v_less_id, 'Calculating combinations to determine lines from points'),
    (v_less_id, 'Calculating compound probability using the inclusion-exclusion principle');

  -- =======================================================================
  -- DOMAIN 4: GEOMETRY AND TRIGONOMETRY (~15%)
  -- =======================================================================
  select id into v_cat_geom from categories where subject_id = v_subject_id and lower(name) = 'geometry and trigonometry';
  if v_cat_geom is null then
    insert into categories (subject_id, name, description)
    values (v_subject_id, 'Geometry and Trigonometry', 'Area, volume, angles, circles, and trigonometry')
    returning id into v_cat_geom;
  end if;

  -- Chapter: Circles
  insert into chapters (category_id, name) values (v_cat_geom, 'Circles') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Circles') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Circle equations in standard form and testing point locations');

  -- Chapter: Lines, Angles, and Triangles
  insert into chapters (category_id, name) values (v_cat_geom, 'Lines and Angles') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Lines, angles, and triangles') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Parallel lines cut by transversals and polygon interior angles'),
    (v_less_id, 'Exterior angle theorem and parallel line angle relationships');

  -- Chapter: Area and Volume
  insert into chapters (category_id, name) values (v_cat_geom, '3D Geometry and Solids') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Area and volume formulas') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Cross-sectional areas of right cones and Pythagorean theorem');

  -- Chapter: Right Triangles & Trigonometry
  insert into chapters (category_id, name) values (v_cat_geom, 'Triangles and Similarity') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Right triangles and trigonometry') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Similar right triangles and calculating altitude lengths');

end $$;