-- =========================================================================
-- SEED COMPLETE SAT & ACT MATH TAXONOMY
-- =========================================================================

do $$
declare
  v_org_id uuid;
  
  -- SAT Variables
  v_sat_exam_id uuid;
  v_sat_subject_id uuid;
  v_sat_cat_alg uuid;
  v_sat_cat_adv uuid;
  v_sat_cat_psda uuid;
  v_sat_cat_geom uuid;

  -- ACT Variables
  v_act_exam_id uuid;
  v_act_subject_id uuid;
  v_act_cat_prealg uuid;
  v_act_cat_intalg uuid;
  v_act_cat_coord uuid;
  v_act_cat_plane uuid;
  v_act_cat_trig uuid;
  v_act_cat_stat uuid;

  v_chap_id uuid;
  v_less_id uuid;
begin
  select id into v_org_id from organizations limit 1;
  if v_org_id is null then
    insert into organizations (name) values ('Primary Academy') returning id into v_org_id;
  end if;

  -- =======================================================================
  -- 1. SAT (DIGITAL SAT MATH)
  -- =======================================================================
  select id into v_sat_exam_id from exams where organization_id = v_org_id and lower(name) = 'sat';
  if v_sat_exam_id is null then
    insert into exams (organization_id, name, description)
    values (v_org_id, 'SAT', 'Digital SAT Suite (College Board)')
    returning id into v_sat_exam_id;
  end if;

  select id into v_sat_subject_id from subjects where exam_id = v_sat_exam_id and lower(name) = 'math';
  if v_sat_subject_id is null then
    insert into subjects (exam_id, name, description)
    values (v_sat_exam_id, 'Math', 'Digital SAT Mathematics')
    returning id into v_sat_subject_id;
  end if;

  -- SAT Domain 1: Algebra (~35%)
  select id into v_sat_cat_alg from categories where subject_id = v_sat_subject_id and lower(name) = 'algebra';
  if v_sat_cat_alg is null then
    insert into categories (subject_id, name, description)
    values (v_sat_subject_id, 'Algebra', 'Linear equations, inequalities, systems, and linear functions')
    returning id into v_sat_cat_alg;
  end if;

  insert into chapters (category_id, name) values (v_sat_cat_alg, 'Linear Equations in One Variable') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Linear equations in one variable') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Solving linear equations in one variable'),
    (v_less_id, 'Equations with one, zero, or infinitely many solutions'),
    (v_less_id, 'Linear word problems and context modeling');

  insert into chapters (category_id, name) values (v_sat_cat_alg, 'Linear Functions & Slopes') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Linear functions') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Interpreting slope and y-intercept in context'),
    (v_less_id, 'Writing linear function equations from points and tables'),
    (v_less_id, 'Parallel and perpendicular line relationships');

  insert into chapters (category_id, name) values (v_sat_cat_alg, 'Systems of Linear Equations') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Systems of two linear equations in two variables') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Solving linear systems algebraically (substitution and elimination)'),
    (v_less_id, 'Number of solutions in linear systems (parallel, intersecting, coincident)'),
    (v_less_id, 'Systems of linear equations word problems');

  insert into chapters (category_id, name) values (v_sat_cat_alg, 'Linear Inequalities') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Linear inequalities in one or two variables') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Solving and graphing linear inequalities in one variable'),
    (v_less_id, 'Graphing two-variable linear inequality systems'),
    (v_less_id, 'Absolute value inequalities and bounds');

  -- SAT Domain 2: Advanced Math (~35%)
  select id into v_sat_cat_adv from categories where subject_id = v_sat_subject_id and lower(name) = 'advanced math';
  if v_sat_cat_adv is null then
    insert into categories (subject_id, name)
    values (v_sat_subject_id, 'Advanced Math')
    returning id into v_sat_cat_adv;
  end if;

  insert into chapters (category_id, name) values (v_sat_cat_adv, 'Equivalent Expressions') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Equivalent expressions') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Laws of exponents and radical expressions'),
    (v_less_id, 'Polynomial addition, subtraction, and multiplication'),
    (v_less_id, 'Factoring quadratic and higher-degree polynomials'),
    (v_less_id, 'Simplifying and rewriting rational expressions');

  insert into chapters (category_id, name) values (v_sat_cat_adv, 'Nonlinear Equations') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Nonlinear equations in one variable') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Solving quadratic equations (factoring, quadratic formula, vertex form)'),
    (v_less_id, 'The discriminant and nature of quadratic roots'),
    (v_less_id, 'Solving radical and rational equations with extraneous roots'),
    (v_less_id, 'Solving exponential equations');

  insert into chapters (category_id, name) values (v_sat_cat_adv, 'Nonlinear Functions & Modeling') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Nonlinear functions') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Quadratic parabolas (vertex, axis of symmetry, intercepts)'),
    (v_less_id, 'Exponential growth and decay models'),
    (v_less_id, 'Function notation and transformations $f(x + c) + d$');

  -- SAT Domain 3: Problem-Solving and Data Analysis (~15%)
  select id into v_sat_cat_psda from categories where subject_id = v_sat_subject_id and lower(name) = 'problem-solving and data analysis';
  if v_sat_cat_psda is null then
    insert into categories (subject_id, name)
    values (v_sat_subject_id, 'Problem-Solving and Data Analysis')
    returning id into v_sat_cat_psda;
  end if;

  insert into chapters (category_id, name) values (v_sat_cat_psda, 'Ratios, Rates, and Units') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Ratios, rates, proportional relationships, and units') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Unit conversion and dimensional analysis'),
    (v_less_id, 'Proportional reasoning and scale factor modeling');

  insert into chapters (category_id, name) values (v_sat_cat_psda, 'Percentages & Growth') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Percentages') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Percent increase, decrease, and multi-step percent change');

  insert into chapters (category_id, name) values (v_sat_cat_psda, 'Data Distributions & Statistics') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'One-variable data: distributions and measures of center and spread') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Mean, median, mode, range, and standard deviation'),
    (v_less_id, 'Box plots, histograms, and frequency distributions');

  insert into chapters (category_id, name) values (v_sat_cat_psda, 'Two-Variable Data & Probability') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Two-variable data: models and scatterplots') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Scatterplots and linear/exponential lines of best fit'),
    (v_less_id, 'Two-way tables and conditional probability'),
    (v_less_id, 'Margin of error and statistical sample inference');

  -- SAT Domain 4: Geometry and Trigonometry (~15%)
  select id into v_sat_cat_geom from categories where subject_id = v_sat_subject_id and lower(name) = 'geometry and trigonometry';
  if v_sat_cat_geom is null then
    insert into categories (subject_id, name)
    values (v_sat_subject_id, 'Geometry and Trigonometry')
    returning id into v_sat_cat_geom;
  end if;

  insert into chapters (category_id, name) values (v_sat_cat_geom, 'Area and Volume') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Area and volume formulas') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, '2D area and perimeter (triangles, quadrilaterals, composite shapes)'),
    (v_less_id, '3D surface area and volume (cylinders, cones, prisms, spheres)');

  insert into chapters (category_id, name) values (v_sat_cat_geom, 'Lines, Angles, and Triangles') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Lines, angles, and triangles') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Parallel lines, transversals, and angle theorems'),
    (v_less_id, 'Similar triangles and scale ratios'),
    (v_less_id, 'Pythagorean theorem and special right triangles (30-60-90, 45-45-90)');

  insert into chapters (category_id, name) values (v_sat_cat_geom, 'Right Triangles and Trigonometry') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Right triangles and trigonometry') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Trigonometric ratios (sin, cos, tan) and complementary angles'),
    (v_less_id, 'Radian measure and arc length conversions');

  insert into chapters (category_id, name) values (v_sat_cat_geom, 'Circles') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Circles') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Circle equations in coordinate form $(x - h)^2 + (y - k)^2 = r^2$'),
    (v_less_id, 'Arc lengths, sector areas, and central/inscribed angles');


  -- =======================================================================
  -- 2. ACT (ACT MATHEMATICS SECTION)
  -- =======================================================================
  select id into v_act_exam_id from exams where organization_id = v_org_id and lower(name) = 'act';
  if v_act_exam_id is null then
    insert into exams (organization_id, name, description)
    values (v_org_id, 'ACT', 'American College Testing')
    returning id into v_act_exam_id;
  end if;

  select id into v_act_subject_id from subjects where exam_id = v_act_exam_id and lower(name) = 'math';
  if v_act_subject_id is null then
    insert into subjects (exam_id, name, description)
    values (v_act_exam_id, 'Math', 'ACT Mathematics Section')
    returning id into v_act_subject_id;
  end if;

  -- ACT Domain 1: Pre-Algebra & Elementary Algebra
  select id into v_act_cat_prealg from categories where subject_id = v_act_subject_id and lower(name) = 'pre-algebra & elementary algebra';
  if v_act_cat_prealg is null then
    insert into categories (subject_id, name)
    values (v_act_subject_id, 'Pre-Algebra & Elementary Algebra')
    returning id into v_act_cat_prealg;
  end if;

  insert into chapters (category_id, name) values (v_act_cat_prealg, 'Numbers and Operations') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Numbers, factors, and primes') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Absolute value, exponents, and order of operations'),
    (v_less_id, 'Greatest common factor, LCM, and prime factorization');

  insert into chapters (category_id, name) values (v_act_cat_prealg, 'Basic Algebra & Word Problems') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Linear modeling and proportions') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Solving linear equations and inequalities in one variable'),
    (v_less_id, 'Ratios, direct and inverse proportions, and percentages');

  -- ACT Domain 2: Intermediate Algebra
  select id into v_act_cat_intalg from categories where subject_id = v_act_subject_id and lower(name) = 'intermediate algebra';
  if v_act_cat_intalg is null then
    insert into categories (subject_id, name)
    values (v_act_subject_id, 'Intermediate Algebra')
    returning id into v_act_cat_intalg;
  end if;

  insert into chapters (category_id, name) values (v_act_cat_intalg, 'Quadratic Equations & Polynomials') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Quadratic functions and polynomials') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Factoring polynomials and quadratic formula'),
    (v_less_id, 'Complex numbers and imaginary unit $i$'),
    (v_less_id, 'Systems of equations with linear and quadratic equations');

  insert into chapters (category_id, name) values (v_act_cat_intalg, 'Rational & Radical Equations') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Radicals and rational expressions') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Simplifying radical expressions and rational exponents'),
    (v_less_id, 'Solving rational equations and finding domain restrictions');

  -- ACT Domain 3: Coordinate Geometry & Functions
  select id into v_act_cat_coord from categories where subject_id = v_act_subject_id and lower(name) = 'coordinate geometry & functions';
  if v_act_cat_coord is null then
    insert into categories (subject_id, name)
    values (v_act_subject_id, 'Coordinate Geometry & Functions')
    returning id into v_act_cat_coord;
  end if;

  insert into chapters (category_id, name) values (v_act_cat_coord, 'Lines in the Coordinate Plane') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Linear graphs and slopes') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Slope, midpoint, and distance formulas'),
    (v_less_id, 'Parallel and perpendicular lines on coordinate plane');

  insert into chapters (category_id, name) values (v_act_cat_coord, 'Functions, Conics & Logs') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Functions and conic sections') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Function composition $f(g(x))$ and domain/range'),
    (v_less_id, 'Logarithms and properties of logarithmic functions'),
    (v_less_id, 'Equations of circles, ellipses, and parabolas');

  -- ACT Domain 4: Plane Geometry
  select id into v_act_cat_plane from categories where subject_id = v_act_subject_id and lower(name) = 'plane geometry';
  if v_act_cat_plane is null then
    insert into categories (subject_id, name)
    values (v_act_subject_id, 'Plane Geometry')
    returning id into v_act_cat_plane;
  end if;

  insert into chapters (category_id, name) values (v_act_cat_plane, 'Triangles and Polygons') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Geometric shapes and properties') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Angles in intersecting lines and polygons ($180(n-2)$)'),
    (v_less_id, 'Isosceles, equilateral, and right triangles'),
    (v_less_id, 'Area, perimeter, and volume of composite 3D solids');

  -- ACT Domain 5: Trigonometry
  select id into v_act_cat_trig from categories where subject_id = v_act_subject_id and lower(name) = 'trigonometry';
  if v_act_cat_trig is null then
    insert into categories (subject_id, name)
    values (v_act_subject_id, 'Trigonometry')
    returning id into v_act_cat_trig;
  end if;

  insert into chapters (category_id, name) values (v_act_cat_trig, 'Trigonometric Functions & Identities') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Trigonometry in right and oblique triangles') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Basic trigonometric ratios (sin, cos, tan, sec, csc, cot)'),
    (v_less_id, 'Trigonometric identities ($\\sin^2 \\theta + \\cos^2 \\theta = 1$)'),
    (v_less_id, 'Law of Sines and Law of Cosines');

  -- ACT Domain 6: Statistics, Probability & Sequences
  select id into v_act_cat_stat from categories where subject_id = v_act_subject_id and lower(name) = 'statistics, probability & sequences';
  if v_act_cat_stat is null then
    insert into categories (subject_id, name)
    values (v_act_subject_id, 'Statistics, Probability & Sequences')
    returning id into v_act_cat_stat;
  end if;

  insert into chapters (category_id, name) values (v_act_cat_stat, 'Probability and Counting') returning id into v_chap_id;
  insert into lessons (chapter_id, name) values (v_chap_id, 'Probability, counting, and data') returning id into v_less_id;
  insert into skills (lesson_id, name) values
    (v_less_id, 'Arithmetic and geometric sequences ($a_n = a_1 + (n-1)d$)'),
    (v_less_id, 'Combinations and permutations ($nPr, nCr$)'),
    (v_less_id, 'Mean, weighted averages, median, and probability events');

end $$;