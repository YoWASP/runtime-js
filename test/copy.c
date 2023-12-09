#include <stdio.h>

int main(int argc, char **argv)
{
	FILE *r = argc > 1 ? fopen(argv[1], "r") : stdin;
	if (!r)
	{
		perror("fopen:r");
		return 1;
	}
	FILE *w = argc > 2 ? fopen(argv[2], "w") : stdout;
	if (!w)
	{
		perror("fopen:w");
	}

	while (!feof(r))
	{
		char buf[256];
		size_t count = fread(buf, 1, sizeof(buf), r);
		fwrite(buf, 1, count, w);
	}
	fclose(r);
	fclose(w);

	return 0;
}
