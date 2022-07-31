#define _GNU_SOURCE // important, cause otherwise setns is undefined
#include <errno.h>
#include <sched.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h> // for strtok
#include <fcntl.h>
#include <unistd.h>
#include <sys/time.h>

typedef struct container_t { // struct is a specification and this static makes no sense here
    char path[BUFSIZ];
    char *id;
    unsigned int pid;
} container_t;

// All variables are made static, because we believe that this will
// keep them local in scope to the file and not make them persist in state
// between Threads.
// TODO: If this code ever gets multi-threaded please review this assumption to
// not pollute another threads state
static const char *user_id = "1000"; //TODO: Figure out user_id dynamically, or request
static unsigned int msleep_time=1000;
static container_t *containers = NULL;

static char *trimwhitespace(char *str) {
  char *end;

  // Trim leading space
  while(isspace((unsigned char)*str)) str++;

  if(*str == 0)  // All spaces?
    return str;

  // Trim trailing space
  end = str + strlen(str) - 1;
  while(end > str && isspace((unsigned char)*end)) end--;

  // Write new null terminator character
  end[1] = '\0';

  return str;
}

static unsigned long int get_network_cgroup(unsigned int pid) {
    char buf[200], ifname[20];
    unsigned long int r_bytes, t_bytes, r_packets, t_packets;


    char ns_path[BUFSIZ];
    sprintf(ns_path, "/proc/%u/ns/net",pid);

    int fd_ns = open(ns_path, O_RDONLY);   /* Get descriptor for namespace */
    if (fd_ns == -1) {
        printf("open failed");
        exit(1);
    }

    // printf("Entering namespace /proc/%u/ns/net \n", pid);

   if (setns(fd_ns, 0) == -1) { // argument 0 means that any type of NS (IPC, Network, UTS) is allowed
        printf("setns failed");
        exit(1);
    }

    // instead we could also read from ip -s link, but this might not be as consistent: https://serverfault.com/questions/448768/cat-proc-net-dev-and-ip-s-link-show-different-statistics-which-one-is-lyi
    // The web-link is very old though
    // by testing on our machine though ip link also returned significantly smaller values (~50% less)
    FILE * fd = fopen("/proc/net/dev", "r");
    if ( fd == NULL) {
            fprintf(stderr, "Error - file %s failed to open: errno: %d\n", "/proc/net/dev", errno);
            exit(1);
    }

    // skip first two lines
    for (int i = 0; i < 2; i++) {
        fgets(buf, 200, fd);
    }

    unsigned long int total_bytes_all_interfaces = 0;

    while (fgets(buf, 200, fd)) {
        // We are not counting dropped packets, as we believe they will at least show up in the
        // sender side as not dropped.
        // Since we are iterating over all relevant docker containers we should catch these packets at least in one /proc/net/dev file
        sscanf(buf, "%[^:]: %lu %lu %*u %*u %*u %*u %*u %*u %lu %lu", ifname, &r_bytes, &r_packets, &t_bytes, &t_packets);
        // printf("%s: rbytes: %lu rpackets: %lu tbytes: %lu tpackets: %lu\n", ifname, r_bytes, r_packets, t_bytes, t_packets);
        if (strcmp(trimwhitespace(ifname), "lo") == 0) continue;
        total_bytes_all_interfaces += r_bytes+t_bytes;
    }

    fclose(fd);
    close(fd_ns);

    return total_bytes_all_interfaces;

}

static int output_stats(container_t *containers, int length) {

    struct timeval now;
    int i;

    gettimeofday(&now, NULL);
    for(i=0; i<length; i++) {
        printf("%ld%06ld %lu %s\n", now.tv_sec, now.tv_usec, get_network_cgroup(containers[i].pid), containers[i].id);
    }
    usleep(msleep_time*1000);

    return 1;
}

int main(int argc, char **argv) {

    int c;
    int length = 0;

    setvbuf(stdout, NULL, _IONBF, 0);

    while ((c = getopt (argc, argv, "i:s:h")) != -1) {
        switch (c) {
        case 'h':
            printf("Usage: %s [-i msleep_time] [-h]\n\n",argv[0]);
            printf("\t-h      : displays this help\n");
            printf("\t-s      : string of container IDs separated by comma\n");
            printf("\t-i      : specifies the milliseconds sleep time that will be slept between measurements\n\n");
            exit(0);
        case 'i':
            msleep_time = atoi(optarg);
            break;
        case 's':
            containers = malloc(sizeof(container_t));
            char *id = strtok(optarg,",");
            for (; id != NULL; id = strtok(NULL, ",")) {
                //printf("Token: %s\n", id);
                length++;
                containers = realloc(containers, length * sizeof(container_t));
                containers[length-1].id = id;
                sprintf(containers[length-1].path,
                    "/sys/fs/cgroup/user.slice/user-%s.slice/user@%s.service/user.slice/docker-%s.scope/cgroup.procs",
                    user_id, user_id, id);

                FILE* fd = NULL;
                fd = fopen(containers[length-1].path, "r"); // check for general readability only once
                if ( fd == NULL) {
                        fprintf(stderr, "Error - file %s failed to open: errno: %d\n", containers[length-1].path, errno);
                        exit(1);
                }
                fscanf(fd, "%u", &containers[length-1].pid);
                fclose(fd);
            }

            break;
        default:
            fprintf(stderr,"Unknown option %c\n",c);
            exit(-1);
        }
    }

    if(containers == NULL) {
        printf("Please supply at least one container id with -s XXXX\n");
        exit(1);
    }

    while(1) {
        output_stats(containers, length);
    }

    free(containers); // since tools is only aborted by CTRL+C this is never called, but memory is freed on program end

    return 0;
}
