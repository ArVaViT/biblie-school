# Список проблем и ограничений платформы

Документ ведётся по ходу работы над курсом «Книга Деяний Апостолов» в режиме живого учителя: логин через Supabase Auth (в идеале), всё остальное через публичный REST API и Supabase Storage. Каждый пункт — то, что реально помешало или насторожило в процессе «обычной работы учителя», с указанием серьёзности, фактом воспроизведения через API и рекомендацией.

Легенда серьёзности:

- 🔴 **Critical**: нарушает UX студента/учителя, либо риск безопасности.
- 🟠 **High**: заметно ухудшает опыт, требует обходов.
- 🟡 **Medium**: непоследовательность, неудобство, риск будущих багов.
- 🟢 **Low**: мелкие шероховатости, тексты ошибок, DX.

Нумерация сквозная. Когда проблема починена — делаем запись **RESOLVED** со ссылкой на PR.

---

## 1. ♻️ **OBSOLETE** 🟢 Low — Нет программного сценария «войти как учитель» без пароля или service-ключа

**Статус:** пункт снят. Сидеры и автоматизация убраны из репозитория — курсы создаются руками через UI, как у обычного учителя. Если когда-нибудь появится задача массового импорта из CMS, тогда и обсудим Personal API Tokens; сейчас это гипотетическая фича.

---

## 2. ✅ **RESOLVED** 🔴 Critical — `GET /api/v1/courses/{id}` возвращает модули и главы в случайном порядке (по факту — в обратном)

**Fix:** `Course.modules` и `Module.chapters` теперь имеют `order_by="Module.order_index"` / `order_by="Chapter.order_index"` (`backend/app/models/course.py`). Верифицировано на проде: после деплоя главы приходят по возрастанию `order_index`.



**Где:** `backend/app/services/course_service.py::get_course`:

```python
db.query(Course)
  .options(joinedload(Course.modules).joinedload(Module.chapters))
  .filter(Course.id == course_id)
```

Релейшены `Course.modules` (course.py:55) и `Module.chapters` (course.py:75) описаны без `order_by`:

```python
modules = relationship("Module", back_populates="course", cascade="all, delete-orphan")
chapters = relationship("Chapter", back_populates="module", cascade="all, delete-orphan")
```

**Что видит студент:** открывает курс → уроки идут задом наперёд. Для курса «Деяния»:

- модуль 1: сначала «Мини-квиз» (order_index=3), потом «Урок 3», «Урок 2», «Урок 1»;
- модуль 2: сначала «Мини-квиз» (4), потом Урок 7, 6, 5, 4;
- то же самое во всех остальных модулях.

**Репро (проверено):** сидер записал модули и главы с корректными `order_index` (подтверждено прямым SQL-запросом к БД — возрастающий порядок). Но `GET /api/v1/courses/{id}` вернул через API:

```
module 'Модуль 1...' chapter order_index not sorted: [3, 2, 1, 0]
module 'Модуль 2...' chapter order_index not sorted: [4, 3, 2, 1, 0]
module 'Модуль 3...' chapter order_index not sorted: [4, 3, 2, 1, 0]
module 'Модуль 4...' chapter order_index not sorted: [3, 2, 1, 0]
```

**Рекомендация:** добавить `order_by` в оба релейшена модели:

```python
modules = relationship(
    "Module",
    back_populates="course",
    cascade="all, delete-orphan",
    order_by="Module.order_index",
)
chapters = relationship(
    "Chapter",
    back_populates="module",
    cascade="all, delete-orphan",
    order_by="Chapter.order_index",
)
```

Дополнительно — на уровне serializer в `course_service.py::clone_course` уже использует `sorted(..., key=lambda m: m.order_index)`. Значит ожидание правильного порядка в коде есть, просто в основном чтении забыли.

---

## 3. ✅ **RESOLVED** 🟠 High — `question_text` жёстко обрезан на 1000 символов — длинные промпты для эссе невозможны

**Fix:** Лимит в `QuizQuestionCreate.question_text` поднят до 4000 символов (`backend/app/schemas/quiz.py`). Колонка в БД — `Text`, без ограничения. 4000 хватает на полный essay prompt с рубрикой, ссылками на чтения и требованиями к форматированию.



**Где:** `POST /api/v1/quizzes`, схема `QuizQuestionCreate.question_text`.

**Что видит учитель:** я пытался оформить эссе итогового экзамена с полным техзаданием (чтение всех 28 глав, рефлексия в первом абзаце, список тем, формальные требования, критерии). Это ~1250 символов. API отвечает:

```
422 {"detail":[{"type":"string_too_long","loc":["body","questions",40,"question_text"],
"msg":"String should have at most 1000 characters",...}]}
```

**Обход:** пришлось сократить промпт до 945 символов и вынести подробности в отдельный reading-блок главы «Приложение: материалы курса». Это некрасиво — студент во время экзамена видит только обрезанную версию.

**Репро:** запустить сидер с essay-вопросом длиннее 1000 — 422.

**Рекомендация:**

- поднять лимит `question_text` хотя бы до 4000 (поместится нормальный essay prompt);
- или ввести отдельное поле `question_rich_text` без лимита и помечать его как markdown/html.

---

## 4. ♻️ **OBSOLETE AS WRITTEN** 🟢 Low — В `GET /api/v1/courses/{id}` нет ни квизов, ни content-блоков

**Статус:** пункт изначально описывал поведение удалённого сидера, а не реального фронта. Текущая страница курса (`frontend/src/pages/Course/CourseDetail.tsx`) делает всего 3 параллельных запроса при открытии (`getCourse`, `getEnrollmentStatus`, `getCourseCohorts`) и подтягивает блоки/квиз одной конкретной главы только когда студент её открывает. 22-запросного взрыва на оглавлении нет.

**Когда это снова станет важным:** если мы введём пререндер всех глав курса (экспорт в PDF, бэкап, оффлайн-режим) — тогда opt-in `?include=blocks,quizzes` будет иметь смысл. Пока отложено.

---

## 5. ✅ **RESOLVED** 🟡 Medium — Два не совпадающих пути загрузки файлов

**Fix:** бэкенд-эндпоинт `POST /api/v1/files/upload` вместе с `file_service.py`, моделью `File`, таблицей `public.files` (была пуста в Supabase), `SUPABASE_STORAGE_BUCKET` и тестами удалён. Frontend и так никогда его не звал — все реальные загрузки (аватары, обложки, материалы, inline-картинки) идут напрямую в Supabase Storage из `frontend/src/services/storage.ts` по JWT пользователя. Два источника правды схлопнулись в один. Magic-byte-валидация была защитой на мёртвом пути, так что её удаление не меняет реальный уровень безопасности; Supabase Storage RLS-политики на бакетах `avatars` / `course-assets` / `course-materials` по-прежнему контролируют доступ.

---

## 6. ✅ **MITIGATED** 🟠 High — `createSignedUrl` со сроком 1 час → ссылки на материалы протухают

**Fix-as-mitigation:** `frontend/src/services/storage.ts::uploadCourseMaterial` и `getSignedMaterialUrl` теперь подписывают URL на 1 год вместо 1 часа. Практическая проблема учителя решена: ссылка на ранее загруженный PDF не умирает через час.

**Что осталось архитектурно (перенесено в Pt12):** signed URL всё равно зависит от текущего Supabase JWT-секрета. Если секрет ротируют, все `file_url` в существующих блоках протухают одновременно. Правильное решение — хранить в блоке `{bucket, object_path}` и пересчитывать URL на лету сервером. Оставлено на момент, когда ротация секрета реально понадобится.

---

## 7. ✅ **RESOLVED** 🟡 Medium — `POST /api/v1/files/upload` принимает `course_id` как сырую строку

**Где:** `files.py`:

```python
async def upload_file(
    file: UploadFile = File(...),
    course_id: str | None = None,
    ...
```

**Fix:** Параметр теперь `course_id: UUID | None = None` (`backend/app/api/v1/files.py`). FastAPI возвращает 422 на невалидный UUID до обращения к БД. Значение конвертируется в `str` для DB-слоя, где `Course.id` хранится как String (миграция типа колонки — отдельная задача).

---

## 8. ✅ **RESOLVED** 🟢 Low — Возможны тонкие грабли с `CORS_ORIGINS`

**Где:** переменная `CORS_ORIGINS` в `backend/.env`.

**Fix:** `backend/.env.example` содержит явный комментарий про CSV-формат, примеры, упоминание preview-деплоев Vercel. Закрыто в рамках P4.1 аудита (env documentation expansion).

---

## 9. ✅ **RESOLVED** 🟢 Low — `POST /api/v1/courses/{id}/modules/.../chapters` не валидирует уникальность `order_index` внутри модуля

**Репро (не проверял в этот проход, но видно по коду):** если по ошибке отправить две главы с одинаковым `order_index=0` — база примет. UI тогда покажет их в стабильно-неопределённом порядке. В нашем случае не сработало (все order_index разные), но для API без ограничений на уникальность это классическая дыра.

**Fix:** `create_module` / `create_chapter` (`backend/app/services/course_service.py`) теперь автоматически подставляют `max(order_index)+1`, если клиент оставил значение по умолчанию (`0`) и модуль/курс уже непустой. Клиенты, которым нужен конкретный слот (drag-and-drop реордер), по-прежнему передают явный индекс и сами контролируют весь layout.

---

## 10. ♻️ **OBSOLETE** 🟢 Low — Нет прямой возможности «загрузить своё видео»

**Status:** Пункт снят. Типы блоков `video` и `audio`, равно как и одноимённые типы глав, удалены из модели: видео / аудио встраиваются inline внутрь блока `text` через Tiptap-расширения (`YoutubeEmbed`, `AudioEmbed`) на внешние URL. Если мы когда-нибудь захотим хостить видеофайлы у себя, это будет новая фича на уровне блока `text` (не отдельный тип блока).

---

## 11. 🟠 High — Нет типа вопроса `essay`: длинные письменные задания приходится маскировать под `short_answer`

**Где:** `backend/app/schemas/quiz.py` — `question_type: Literal["multiple_choice", "true_false", "short_answer"]`. Тип `essay` упоминается только в комментарии к обработчику `submit_quiz` (`backend/app/api/v1/quizzes.py:251 — "short_answer / essay questions are graded by the teacher afterwards"`), но в схеме отсутствует.

**Что это значит на практике:**

- Для курса «Книга Деяний» обязательное эссе (читать 28 глав, 600–800 слов, 20 баллов) приходится хранить как `short_answer`. В API-ответе (`QuizStudentResponse`) оно выглядит так же, как односложный ответ на мини-вопрос: единое поле `text`, без подсказок студенту по длине, отдельной UI-площадки и напоминания «это эссе, не забудь принести файл/ссылку».
- При ручной оценке учитель видит все `short_answer` вопросы единообразно, без выделения эссе в отдельный workflow (ревью, рубрика, комментарии по критериям). На экзамене из 40 вопросов + 1 эссе это заметно.
- Автоматические пайплайны (отчёты, прогресс, сертификаты) не могут различить «короткий ответ на 1 балл» и «эссе на 20 баллов» по семантике, только по `points`.

**Репро:** попытка создать вопрос с `question_type="essay"` через `POST /api/v1/quizzes` возвращает 422 `string_does_not_match_pattern`. Пришлось хранить как `short_answer` с `points=20`.

**Рекомендация:**

1. Добавить `"essay"` в `Literal` + миграцию поля `question_type` (enum → text), либо создать отдельное дискриминирующее поле `grading_mode: auto | manual | rubric`.
2. Для UI эссе выделить отдельный презентер: textarea с подсказкой по минимальной длине, прикрепление файла, счётчик слов, ссылка на рубрику из описания курса.
3. В экране учителя — отдельная вкладка «Эссе», где сгруппированы все `essay`-ответы студента с контекстом курса и возможностью выставить балл + комментарий по рубрике.

---

## 12. ✅ **RESOLVED** 🟡 Medium — `chapter_blocks.file_url` завязан на текущий Supabase-секрет

**Fix:** колонка `file_url` удалена. Вместо неё в `chapter_blocks` хранятся `file_bucket`, `file_path`, `file_name` — стабильные идентификаторы контента, не зависящие от инструмента доступа. Подписанный URL теперь выдаётся **в момент клика** на фронте (`storageService.getSignedBlockFileUrl`, TTL 1 час). Ротация Supabase JWT-секрета больше не «убивает все файлы в курсах»: следующий клик автоматически получит свежий токен на актуальном секрете.

**Миграция данных (032_chapter_blocks_bucket_path):** существующие `file_url` со схемой `/storage/v1/object/(sign|public)/{bucket}/{path}` и same-origin прокси `/img/{bucket}/{path}` распарсены в `file_bucket`+`file_path` автоматически. Внешние ссылки (Google Drive и т. п.) отброшены — им и так было не место в блоке типа `file`.

**UX учителя:** в `ChapterBlockEditor` блок «file» теперь использует нативный аплоадер (upload → replace → clear) напрямую в Storage. Учителю не нужно знать про signed URLs — он видит имя файла, кнопки `Replace` / `Remove` и всё.

---

## Записи процесса

**2026-04-20 (сессия 1):**

- Сидер переписан на чистый «режим живого пользователя»: Supabase Auth password → access_token → REST API + Storage.
- Добавлен bootstrap-fallback (JWT_SECRET_KEY + service-role для Storage) только для случая, когда пароля нет на руках. Сам fallback задокументирован как проблема №1.
- Проведён полный прогон: курс «Книга Деяний» собран с нуля, 4 модуля, 18 глав, 3 мини-квиза и итоговый экзамен. Использована учётка `arvavitofficial@gmail.com` (role=admin).
- В ходе прогона найдены и зафиксированы проблемы 2–4. Остальные пункты — наблюдения из чтения кода и ревизии потоков.

**2026-04-20 (сессия 2, follow-up):**

- Проверены все 10 пунктов на актуальность против текущего кода. Pt2 воспроизведён на проде (`GET /courses/{id}` вернул главы `[3,2,1,0]`, `[4,3,2,1,0]`).
- Закрыты пункты 2, 3, 7, 8, 9 (см. RESOLVED выше).
- Открытыми остаются: **Pt1** (Personal API tokens — отдельная фича), **Pt4** (`?include=blocks,quizzes` для экономии N+1), **Pt5/Pt6** (унификация путей загрузки файлов и стабильный URL). Это архитектурные задачи, требующие отдельного планирования.

**2026-04-20 (сессия 3, continue):**

- Прогнан «teacher-eye QA» по живому курсу через API (`GET /courses/{id}` + `/blocks/chapter/{id}` + `/quizzes/{id}`): проверена структура всех 18 глав, валидность HTML, длины уроков, корректность квизов (кол-во правильных ответов, дубликаты опций/вопросов), подписанные ссылки на загруженные PDF (все 200 OK).
- Добавлены пункты **Pt11** (нет типа `essay` в схеме вопросов) и **Pt12** (подписанные `file_url` в блоках жёстко привязаны к текущему Supabase-секрету — ротация ломает весь контент).
- Контентный побочный эффект: каждый урок в сидере теперь склеивается в один текстовый блок (вместо 3 отдельных «карточек» — intro-callouts → prose → takeaway). Чистая UX-починка, сделана через API (`_coalesce_text_blocks` в сидере).

**2026-04-22 (сессия DB cleanup):**

- Альтернативно к пункту Pt10: типы блоков `video` / `audio` выпилены полностью, видео и аудио встраиваются внутрь текстового блока через Tiptap-расширения. Pt10 помечен OBSOLETE.
- DB-миграции 026–029: убраны мёртвые колонки `chapters.content`, `chapters.video_url`, `chapter_blocks.video_url`, `courses.start_date`, `courses.end_date` — ни один путь в бэке или фронте их не читал. Дропнуты 14 избыточных индексов (чистые дубли уникальных ограничений, одноколоночные FK-индексы, покрытые составными, бесполезный B-tree на булевом `is_read`).
- `course_service.get_*` переведён с `joinedload` на `selectinload` для цепочки Course → Module → Chapter, чтобы избежать row-explosion при выборке дерева курса.
- Перевалидирован Pt4 против реального кода `CourseDetail.tsx`: страница курса делает 3 параллельных запроса, а не 22. Пункт помечен **OBSOLETE AS WRITTEN** — остаётся справочным на случай будущей фичи «экспорт всего курса».

**2026-04-22 (сессия repo cleanup):**

- Удалена папка `scripts/` целиком: `seed_acts_course.py`, `acts_content.py`, `build_sources_pdf.py`, `assets/acts_sources.{md,pdf}` и `ruff.toml`. Курсы создаются руками через UI, одноразовый сидер «Деяний» в репозитории не нужен.
- `scripts/PLATFORM_ISSUES.md` перенесён в `docs/PLATFORM_ISSUES.md` — это документация, не исполняемый код.
- Pt1 помечен **OBSOLETE**: программная авторизация скриптов больше не нужна.

**2026-04-22 (сессия repo cleanup, продолжение):**

- Добавлен серверный sanitize на путь `POST /blocks/chapter/{id}` и `PUT /blocks/{id}`. Прямой API-вызов уже не может сохранить `<script>` в `chapter_blocks.content`.
- **Pt5 RESOLVED**: удалён дохлый backend-путь `POST /api/v1/files/upload` со всей обвязкой (эндпоинт, `file_service.py`, модель `File`, таблица `public.files` в Supabase, `SUPABASE_STORAGE_BUCKET`, тесты, ссылки в `.env.example` и `rate_limit.py`). Фронт его никогда не звал, прод-таблица была пуста. Миграция `030_drop_files_table`.
- **Pt6 MITIGATED**: TTL на signed URL у `uploadCourseMaterial` / `getSignedMaterialUrl` поднят до 1 года. Практическая боль («материал протух через час») ушла. Архитектурная часть — хранить `{bucket, object_path}` в блоке и подписывать серверно — остаётся в Pt12.
- Закрыты 3 из 4 Supabase Security Advisor warnings: у функций `update_updated_at`, `courses_search_vector_update`, `custom_access_token_hook` теперь явно зафиксирован `search_path = pg_catalog, public` (миграция `031_lock_function_search_paths`). Единственный оставшийся advisor — Leaked Password Protection Disabled — это Supabase Dashboard toggle, не код.
- Открытыми остаются: **Pt11** (нет `essay` как типа вопроса), **Pt12** (signed URL в `file_url` блока завязан на текущий Supabase-секрет).

**2026-04-22 (сессия file-blocks + account deletion):**

- **Pt12 RESOLVED:** `chapter_blocks.file_url` заменён на `file_bucket` + `file_path` + `file_name` (миграция `032_chapter_blocks_bucket_path`, с авто-парсингом существующих signed/public/proxy URL). Подписанные ссылки теперь выдаются на лету на клиенте через `storageService.getSignedBlockFileUrl` (TTL 1 час), и ротация Supabase JWT-секрета больше не ломает контент всех курсов одновременно.
- **User self-delete удалён:** `DELETE /users/me` снят с сервера, «Danger Zone» из `ProfilePage` убрана. Удаление аккаунта теперь — только административный инструмент: `DELETE /api/v1/users/admin/{user_id}` с cascade-пургой (через общий `_purge_user`), проверкой admin-роли и защитой от «админ удаляет себя». В UI админки добавлена кнопка-корзина в списке пользователей (виртуализированный + обычный рендер), disabled для собственной строки.
- Открытым остаётся только **Pt11** (essay как тип вопроса) и Supabase Dashboard toggle для Leaked Password Protection.
